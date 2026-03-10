"""Load video CSV, derive metrics, and build normalized feature matrix for ML."""

from __future__ import annotations

import pathlib
from datetime import date

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

CSV_PATH = pathlib.Path(__file__).resolve().parents[2] / "sample_videos.csv"

FEATURE_COLS = [
    "log_views",
    "avg_watch_time_per_view",
    "engagement_rate",
    "like_rate",
    "share_rate",
    "comment_rate",
]


def load_raw(path: pathlib.Path = CSV_PATH) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"video_id": str})

    # Coerce numeric columns; non-parseable values become NaN
    numeric_cols = ["views", "watch_time_seconds", "likes", "comments", "shares"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["publish_date"] = pd.to_datetime(df["publish_date"], errors="coerce")

    # Drop rows with critical nulls
    before = len(df)
    df = df.dropna(subset=["views", "watch_time_seconds", "publish_date"])
    if before - len(df) > 0:
        pass  # optional: log dropped rows

    # avoid div by zero
    df = df[df["views"] > 0].copy()

    # Temporal fields
    today = pd.Timestamp(date.today())
    df["days_since_publish"] = (today - df["publish_date"]).dt.days
    df["publish_month"] = df["publish_date"].dt.to_period("M").astype(str)
    df["publish_day_of_week"] = df["publish_date"].dt.day_name()

    df = df.reset_index(drop=True)
    return df


def add_derived_metrics(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Watch time
    df["avg_watch_time_per_view"] = df["watch_time_seconds"] / df["views"]  # seconds

    # Engagement components
    df["like_rate"] = df["likes"] / df["views"]
    df["comment_rate"] = df["comments"] / df["views"]
    df["share_rate"] = df["shares"] / df["views"]

    # Composite engagement rate (all interactions / views)
    df["engagement_rate"] = (df["likes"] + df["comments"] + df["shares"]) / df["views"]

    # Virality proxy: shares weighted more heavily than likes
    df["virality_score"] = (df["shares"] * 3 + df["likes"]) / df["views"]

    # Performance tiers based on raw views (used for labeling)
    view_quantiles = df["views"].quantile([0.33, 0.67])
    df["view_tier"] = pd.cut(
        df["views"],
        bins=[-np.inf, view_quantiles.iloc[0], view_quantiles.iloc[1], np.inf],
        labels=["Low Reach", "Mid Reach", "High Reach"],
    )

    return df


def add_log_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # views and watch_time_seconds are highly right-skewed
    df["log_views"] = np.log1p(df["views"])
    df["log_watch_time"] = np.log1p(df["watch_time_seconds"])
    return df


def build_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, StandardScaler]:
    X = df[FEATURE_COLS].values.astype(np.float64)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, scaler


def load_and_process(path: pathlib.Path = CSV_PATH) -> tuple[pd.DataFrame, np.ndarray, StandardScaler]:
    df = load_raw(path)
    df = add_derived_metrics(df)
    df = add_log_features(df)
    X_scaled, scaler = build_feature_matrix(df)
    return df, X_scaled, scaler
