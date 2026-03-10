"""K-Means clustering on performance features + UMAP projection and cluster naming."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import umap

from .etl import FEATURE_COLS

RANDOM_SEED = 42


def cluster_2d_baseline(df: pd.DataFrame) -> np.ndarray:
    X2 = df[["log_views", "engagement_rate"]].values
    km = KMeans(n_clusters=3, random_state=RANDOM_SEED, n_init="auto")
    labels = km.fit_predict(X2)
    return labels


def _elbow_k(X: np.ndarray, k_range: range = range(2, 9)) -> int:
    inertias = [KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init="auto").fit(X).inertia_ for k in k_range]
    deltas = np.diff(inertias)
    accel = np.diff(deltas)
    return k_range[int(np.argmax(-accel)) + 2]


def cluster_multifeature(
    X_scaled: np.ndarray, k: int | None = None
) -> tuple[np.ndarray, KMeans, int]:
    if k is None:
        k = _elbow_k(X_scaled)
        k = max(3, min(k, 6))

    km = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init="auto")
    labels = km.fit_predict(X_scaled)
    return labels, km, k


def umap_project(
    X_scaled: np.ndarray, n_neighbors: int = 15, min_dist: float = 0.1
) -> np.ndarray:
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        random_state=RANDOM_SEED,
        metric="euclidean",
    )
    embedding = reducer.fit_transform(X_scaled)
    return embedding


def _name_clusters(df: pd.DataFrame, labels: np.ndarray) -> dict[int, str]:
    tmp = df.copy()
    tmp["cluster"] = labels

    stats = tmp.groupby("cluster").agg(
        med_views=("views", "median"),
        med_engagement=("engagement_rate", "median"),
        med_watch=("avg_watch_time_per_view", "median"),
        med_share=("share_rate", "median"),
        n=("views", "count"),
    )

    reach_rank = stats["med_views"].rank()
    engage_rank = stats["med_engagement"].rank()
    watch_rank = stats["med_watch"].rank()

    n_clusters = len(stats)
    mid = (n_clusters + 1) / 2
    print(stats.index)

    names: dict[int, str] = {}
    for cid in stats.index:
        r = reach_rank[cid]
        e = engage_rank[cid]
        w = watch_rank[cid]

        if r >= mid and e >= mid:
            names[cid] = "Viral Stars"
        elif r >= mid and e < mid:
            names[cid] = "High Reach"
        elif r < mid and e >= mid:
            names[cid] = (
                "Sleeper Hits"  # lower reach, viral via engagement (retention, shares, likes)
            )
        elif w >= mid:
            names[cid] = "Deep Watch"
        else:
            names[cid] = "Low Performers"

    seen: dict[str, int] = {}
    for cid, name in names.items():
        seen[name] = seen.get(name, 0) + 1
        if seen[name] > 1:
            names[cid] = f"{name} II"

    return names


def run_clustering(df: pd.DataFrame, X_scaled: np.ndarray) -> dict:
    _ = cluster_2d_baseline(df)  # baseline not exposed
    labels, km, k = cluster_multifeature(X_scaled)
    embedding = umap_project(X_scaled)
    cluster_names = _name_clusters(df, labels)

    # Per-cluster stats for the frontend profile cards
    tmp = df.copy()
    tmp["cluster"] = labels
    cluster_stats = (
        tmp.groupby("cluster")
        .agg(
            count=("views", "count"),
            avg_views=("views", "mean"),
            avg_engagement=("engagement_rate", "mean"),
            avg_watch_time=("avg_watch_time_per_view", "mean"),
            avg_share_rate=("share_rate", "mean"),
            top_category=("category", lambda x: x.mode().iloc[0]),
        )
        .reset_index()
    )
    cluster_stats["name"] = cluster_stats["cluster"].map(cluster_names)
    cluster_stats_list = cluster_stats.to_dict(orient="records")

    return {
        "labels": labels.tolist(),
        "cluster_names": {str(k): v for k, v in cluster_names.items()},
        "umap_x": embedding[:, 0].tolist(),
        "umap_y": embedding[:, 1].tolist(),
        "cluster_stats": cluster_stats_list,
        "elbow_k": k,
    }
