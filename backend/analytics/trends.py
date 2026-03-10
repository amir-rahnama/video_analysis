"""Correlation matrix, category/thumbnail breakdowns, and time-series trends."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

CORR_COLS = [
    "views",
    "avg_watch_time_per_view",
    "engagement_rate",
    "like_rate",
    "comment_rate",
    "share_rate",
    "virality_score",
    "days_since_publish",
]


def compute_correlation_matrix(df: pd.DataFrame) -> dict:
    subset = df[CORR_COLS].dropna()
    corr_df = subset.corr(method="pearson")

    n = len(subset)
    pval_matrix = np.ones_like(corr_df.values)
    for i in range(len(CORR_COLS)):
        for j in range(len(CORR_COLS)):
            if i != j:
                r = corr_df.values[i, j]
                # Clamp r to avoid sqrt of negative
                r = np.clip(r, -0.9999, 0.9999)
                t = r * np.sqrt((n - 2) / (1 - r ** 2))
                pval_matrix[i, j] = 2 * scipy_stats.t.sf(abs(t), df=n - 2)

    return {
        "columns": CORR_COLS,
        "matrix": np.round(corr_df.values, 4).tolist(),
        "pvalues": np.round(pval_matrix, 6).tolist(),
    }


def category_breakdown(df: pd.DataFrame) -> list[dict]:
    """Aggregate key metrics per content category."""
    agg = (
        df.groupby("category")
        .agg(
            count=("views", "count"),
            total_views=("views", "sum"),
            avg_views=("views", "mean"),
            avg_engagement=("engagement_rate", "mean"),
            avg_watch_time=("avg_watch_time_per_view", "mean"),
            avg_share_rate=("share_rate", "mean"),
            avg_like_rate=("like_rate", "mean"),
            avg_virality=("virality_score", "mean"),
        )
        .reset_index()
    )
    # Round floats
    float_cols = [c for c in agg.columns if agg[c].dtype == float]
    agg[float_cols] = agg[float_cols].round(4)
    return agg.to_dict(orient="records")


def thumbnail_breakdown(df: pd.DataFrame) -> list[dict]:
    agg = (
        df.groupby("thumbnail_style")
        .agg(
            count=("views", "count"),
            avg_views=("views", "mean"),
            avg_engagement=("engagement_rate", "mean"),
            avg_share_rate=("share_rate", "mean"),
            avg_like_rate=("like_rate", "mean"),
            avg_watch_time=("avg_watch_time_per_view", "mean"),
        )
        .reset_index()
    )
    float_cols = [c for c in agg.columns if agg[c].dtype == float]
    agg[float_cols] = agg[float_cols].round(4)
    return agg.to_dict(orient="records")


def category_thumbnail_heatmap(df: pd.DataFrame) -> dict:
    ct = (
        df.groupby(["category", "thumbnail_style"])["engagement_rate"]
        .mean()
        .reset_index()
        .rename(columns={"engagement_rate": "avg_engagement"})
    )
    ct["avg_engagement"] = ct["avg_engagement"].round(4)
    return ct.to_dict(orient="records")


def monthly_time_series(df: pd.DataFrame) -> list[dict]:
    ts = (
        df.groupby("publish_month")
        .agg(
            total_views=("views", "sum"),
            avg_engagement=("engagement_rate", "mean"),
            avg_virality=("virality_score", "mean"),
            count=("views", "count"),
        )
        .reset_index()
        .sort_values("publish_month")
    )
    float_cols = [c for c in ts.columns if ts[c].dtype == float]
    ts[float_cols] = ts[float_cols].round(4)
    return ts.to_dict(orient="records")


def day_of_week_analysis(df: pd.DataFrame) -> list[dict]:
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dow = (
        df.groupby("publish_day_of_week")
        .agg(
            count=("views", "count"),
            avg_views=("views", "mean"),
            avg_engagement=("engagement_rate", "mean"),
            avg_share_rate=("share_rate", "mean"),
        )
        .reindex(day_order)
        .reset_index()
        .rename(columns={"publish_day_of_week": "day"})
    )
    float_cols = [c for c in dow.columns if dow[c].dtype == float]
    dow[float_cols] = dow[float_cols].round(4)
    return dow.to_dict(orient="records")


def top_performing_attributes(df: pd.DataFrame) -> dict:
    top_cat_engagement = df.groupby("category")["engagement_rate"].mean().idxmax()
    top_cat_views = df.groupby("category")["views"].mean().idxmax()
    top_thumb_share = df.groupby("thumbnail_style")["share_rate"].mean().idxmax()
    top_thumb_engagement = df.groupby("thumbnail_style")["engagement_rate"].mean().idxmax()

    return {
        "top_category_by_engagement": top_cat_engagement,
        "top_category_by_views": top_cat_views,
        "top_thumbnail_by_shares": top_thumb_share,
        "top_thumbnail_by_engagement": top_thumb_engagement,
    }


def run_trends(df: pd.DataFrame) -> dict:
    return {
        "correlation": compute_correlation_matrix(df),
        "category_breakdown": category_breakdown(df),
        "thumbnail_breakdown": thumbnail_breakdown(df),
        "category_thumbnail_heatmap": category_thumbnail_heatmap(df),
        "monthly_time_series": monthly_time_series(df),
        "day_of_week": day_of_week_analysis(df),
        "top_attributes": top_performing_attributes(df),
    }
