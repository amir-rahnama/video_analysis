"""Z-score + Isolation Forest anomaly detection with semantic labels (Breakout, Underperformer, etc.)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .etl import FEATURE_COLS

RANDOM_SEED = 42
ZSCORE_THRESHOLD = 2.5
IF_CONTAMINATION = 0.08

ZSCORE_METRICS = ["views", "engagement_rate", "avg_watch_time_per_view", "share_rate"]


def zscore_flags(df: pd.DataFrame) -> pd.DataFrame:
    z_df = pd.DataFrame(index=df.index)
    for col in ZSCORE_METRICS:
        mean = df[col].mean()
        std = df[col].std()
        z_df[f"z_{col}"] = (df[col] - mean) / (std + 1e-9)

    z_df["is_zscore_outlier"] = (z_df.abs() > ZSCORE_THRESHOLD).any(axis=1)
    return z_df


def isolation_forest_scores(X_scaled: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    iso = IsolationForest(
        n_estimators=200,
        contamination=IF_CONTAMINATION,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    iso.fit(X_scaled)
    flags = iso.predict(X_scaled)
    scores = iso.decision_function(X_scaled)
    return flags, scores


def classify_anomaly(row: pd.Series, z_row: pd.Series) -> str:
    z_views = z_row.get("z_views", 0)
    z_engagement = z_row.get("z_engagement_rate", 0)
    z_watch = z_row.get("z_avg_watch_time_per_view", 0)
    z_share = z_row.get("z_share_rate", 0)

    if z_views > ZSCORE_THRESHOLD and z_engagement < 0:
        return "Breakout"
    if z_views < -ZSCORE_THRESHOLD and z_engagement > 0:
        return "Underperformer"
    if z_watch > ZSCORE_THRESHOLD:
        return "Watch Magnet"
    if z_engagement > ZSCORE_THRESHOLD or z_share > ZSCORE_THRESHOLD:
        return "Engagement Spike"
    if z_views > ZSCORE_THRESHOLD:
        return "Breakout"
    if z_views < -ZSCORE_THRESHOLD:
        return "Underperformer"
    return "Statistical Outlier"


def run_anomaly_detection(df: pd.DataFrame, X_scaled: np.ndarray) -> dict:
    z_df = zscore_flags(df)
    if_flags, if_scores = isolation_forest_scores(X_scaled)

    # Combine: a video is anomalous if flagged by Isolation Forest
    result = df[
        [
            "video_id",
            "title",
            "category",
            "views",
            "engagement_rate",
            "avg_watch_time_per_view",
            "share_rate",
            "thumbnail_style",
            "publish_date",
        ]
    ].copy()
    result["publish_date"] = result["publish_date"].dt.strftime("%Y-%m-%d")

    result["if_flag"] = if_flags  # -1 or 1
    result["if_score"] = np.round(if_scores, 4)
    result["zscore_outlier"] = z_df["is_zscore_outlier"].values

    # Normalized anomaly score 0–1 (1 = most anomalous)
    raw = -if_scores  # higher = more anomalous
    result["anomaly_score"] = np.round(
        (raw - raw.min()) / (raw.max() - raw.min() + 1e-9), 4
    )

    is_anomaly = if_flags == -1
    result["is_anomaly"] = is_anomaly

    anomaly_types = []
    for idx in result.index:
        if is_anomaly[idx]:
            z_row = z_df.loc[idx]
            row = result.loc[idx]
            anomaly_types.append(classify_anomaly(row, z_row))
        else:
            anomaly_types.append(None)
    result["anomaly_type"] = anomaly_types

    anomaly_rows = (
        result[result["is_anomaly"]]
        .sort_values("anomaly_score", ascending=False)
        .reset_index(drop=True)
    )

    float_cols = [
        "engagement_rate",
        "avg_watch_time_per_view",
        "share_rate",
        "if_score",
        "anomaly_score",
    ]
    for col in float_cols:
        result[col] = result[col].round(4)
        if col in anomaly_rows.columns:
            anomaly_rows[col] = anomaly_rows[col].round(4)

    summary = (
        anomaly_rows["anomaly_type"]
        .value_counts()
        .reset_index()
        .rename(columns={"anomaly_type": "type", "count": "count"})
        .to_dict(orient="records")
    )

    return {
        "anomalies": anomaly_rows.to_dict(orient="records"),
        "all_scores": result[
            [
                "video_id",
                "anomaly_score",
                "is_anomaly",
                "anomaly_type",
                "views",
                "engagement_rate",
            ]
        ].to_dict(orient="records"),
        "summary": summary,
        "total_anomalies": int(is_anomaly.sum()),
        "contamination_rate": round(float(is_anomaly.mean()), 4),
    }
