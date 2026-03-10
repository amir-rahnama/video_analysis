"""Dashboard API: analytics run at startup and served from memory."""

from __future__ import annotations

import math
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from analytics.etl import load_and_process
from analytics.clustering import run_clustering
from analytics.trends import run_trends
from analytics.anomaly import run_anomaly_detection

cache: dict = {}


def _safe_json(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_json(v) for v in obj]
    return obj


@asynccontextmanager
async def lifespan(app: FastAPI):
    df, X_scaled, _ = load_and_process()
    cache["df"] = df
    cache["X_scaled"] = X_scaled
    cache["clusters"] = _safe_json(run_clustering(df, X_scaled))
    cache["trends"] = _safe_json(run_trends(df))
    cache["anomalies"] = _safe_json(run_anomaly_detection(df, X_scaled))
    yield
    cache.clear()


app = FastAPI(
    title="Content Performance Insights API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _filter_df(
    df: pd.DataFrame,
    category: Optional[str] = None,
    thumbnail_style: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> pd.DataFrame:
    mask = pd.Series([True] * len(df), index=df.index)
    if category:
        mask &= df["category"] == category
    if thumbnail_style:
        mask &= df["thumbnail_style"] == thumbnail_style
    if date_from:
        mask &= df["publish_date"] >= pd.Timestamp(date_from)
    if date_to:
        mask &= df["publish_date"] <= pd.Timestamp(date_to)
    return df[mask]


@app.get("/api/health")
def health():
    return {"status": "ok", "videos_loaded": len(cache.get("df", []))}


@app.get("/api/overview")
def overview(
    category: Optional[str] = Query(None),
    thumbnail_style: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """High-level KPI summary. Respects filters."""
    df = cache["df"]
    df = _filter_df(df, category, thumbnail_style, date_from, date_to)

    if len(df) == 0:
        raise HTTPException(status_code=404, detail="No data matches the applied filters.")

    top_cat = df.groupby("category")["engagement_rate"].mean().idxmax()
    top_thumb = df.groupby("thumbnail_style")["share_rate"].mean().idxmax()

    return _safe_json({
        "total_videos": int(len(df)),
        "total_views": int(df["views"].sum()),
        "avg_views": round(float(df["views"].mean()), 0),
        "avg_engagement_rate": round(float(df["engagement_rate"].mean()), 4),
        "avg_watch_time_per_view": round(float(df["avg_watch_time_per_view"].mean()), 1),
        "avg_share_rate": round(float(df["share_rate"].mean()), 4),
        "top_category_by_engagement": top_cat,
        "top_thumbnail_by_shares": top_thumb,
        "categories": sorted(df["category"].unique().tolist()),
        "thumbnail_styles": sorted(df["thumbnail_style"].unique().tolist()),
        "date_min": df["publish_date"].min().strftime("%Y-%m-%d"),
        "date_max": df["publish_date"].max().strftime("%Y-%m-%d"),
        # For the stacked bar chart
        "category_view_totals": (
            df.groupby("category")["views"]
            .sum()
            .reset_index()
            .rename(columns={"views": "total_views"})
            .to_dict(orient="records")
        ),
        "engagement_distribution": {
            "p25": round(float(df["engagement_rate"].quantile(0.25)), 4),
            "p50": round(float(df["engagement_rate"].quantile(0.50)), 4),
            "p75": round(float(df["engagement_rate"].quantile(0.75)), 4),
            "p90": round(float(df["engagement_rate"].quantile(0.90)), 4),
        },
    })


@app.get("/api/videos")
def videos(
    category: Optional[str] = Query(None),
    thumbnail_style: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: str = Query("views"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """Paginated, filterable video table."""
    df = cache["df"]
    df = _filter_df(df, category, thumbnail_style, date_from, date_to)

    valid_sort_cols = {"views", "engagement_rate", "avg_watch_time_per_view",
                       "share_rate", "publish_date", "virality_score", "like_rate"}
    if sort_by not in valid_sort_cols:
        sort_by = "views"
    ascending = sort_dir.lower() == "asc"
    df = df.sort_values(sort_by, ascending=ascending)

    total = len(df)
    start = (page - 1) * limit
    page_df = df.iloc[start:start + limit]

    display_cols = [
        "video_id", "title", "category", "thumbnail_style", "publish_date",
        "views", "avg_watch_time_per_view", "engagement_rate",
        "like_rate", "comment_rate", "share_rate", "virality_score",
    ]
    page_df = page_df[display_cols].copy()
    page_df["publish_date"] = page_df["publish_date"].dt.strftime("%Y-%m-%d")

    float_cols = ["avg_watch_time_per_view", "engagement_rate", "like_rate",
                  "comment_rate", "share_rate", "virality_score"]
    for c in float_cols:
        page_df[c] = page_df[c].round(4)

    return _safe_json({
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit),
        "data": page_df.to_dict(orient="records"),
    })


@app.get("/api/clusters")
def clusters(
    category: Optional[str] = Query(None),
    thumbnail_style: Optional[str] = Query(None),
):
    """UMAP coordinates + cluster labels. Filters for highlighting only — analysis is global."""
    df = cache["df"]
    cluster_data = cache["clusters"]

    # Build per-video records joining cluster info
    records = []
    for i, row in df.iterrows():
        rec = {
            "video_id": row["video_id"],
            "title": row["title"],
            "category": row["category"],
            "thumbnail_style": row["thumbnail_style"],
            "views": int(row["views"]),
            "engagement_rate": round(float(row["engagement_rate"]), 4),
            "avg_watch_time_per_view": round(float(row["avg_watch_time_per_view"]), 1),
            "cluster": int(cluster_data["labels"][i]),
            "cluster_name": cluster_data["cluster_names"].get(str(cluster_data["labels"][i]), "?"),
            "umap_x": round(float(cluster_data["umap_x"][i]), 4),
            "umap_y": round(float(cluster_data["umap_y"][i]), 4),
            # Dimmed if filtered out
            "highlighted": (
                (category is None or row["category"] == category) and
                (thumbnail_style is None or row["thumbnail_style"] == thumbnail_style)
            ),
        }
        records.append(rec)

    return _safe_json({
        "points": records,
        "cluster_stats": cluster_data["cluster_stats"],
        "cluster_names": cluster_data["cluster_names"],
        "elbow_k": cluster_data["elbow_k"],
    })


@app.get("/api/trends")
def trends(
    category: Optional[str] = Query(None),
    thumbnail_style: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """
    Trend analysis. If filters are applied, recompute lightweight stats on the fly;
    heavy correlation matrix comes from the pre-computed cache.
    """
    df = cache["df"]
    filtered_df = _filter_df(df, category, thumbnail_style, date_from, date_to)

    # Always return global correlation (computed from full dataset)
    base = cache["trends"]

    if len(filtered_df) > 10:
        from analytics.trends import (
            category_breakdown, thumbnail_breakdown,
            monthly_time_series, day_of_week_analysis, top_performing_attributes,
        )
        return _safe_json({
            "correlation": base["correlation"],  # always global
            "category_breakdown": category_breakdown(filtered_df),
            "thumbnail_breakdown": thumbnail_breakdown(filtered_df),
            "category_thumbnail_heatmap": base["category_thumbnail_heatmap"],
            "monthly_time_series": monthly_time_series(filtered_df),
            "day_of_week": day_of_week_analysis(filtered_df),
            "top_attributes": top_performing_attributes(filtered_df),
        })

    return _safe_json(base)


@app.get("/api/anomalies")
def anomalies():
    """Anomaly detection results — not filter-sensitive (global model)."""
    return _safe_json(cache["anomalies"])
