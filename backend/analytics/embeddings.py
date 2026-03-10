"""Title embeddings (TF-IDF + sentence-transformers), UMAP 2D, and top-k similarity."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import umap

RANDOM_SEED = 42
MODEL_NAME = "all-MiniLM-L6-v2"
TOP_K = 5


def tfidf_similarity(titles: list[str]) -> np.ndarray:
    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)
    tfidf_matrix = vec.fit_transform(titles)
    return cosine_similarity(tfidf_matrix)


def sentence_embeddings(titles: list[str]) -> np.ndarray:
    try:
        from sentence_transformers import SentenceTransformer
        import torch

        device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
        model = SentenceTransformer(MODEL_NAME, device=device)
        return model.encode(titles, batch_size=64, show_progress_bar=False, normalize_embeddings=True)
    except Exception:
        from sklearn.decomposition import TruncatedSVD
        vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
        X = vec.fit_transform(titles).toarray()
        svd = TruncatedSVD(n_components=min(128, X.shape[1] - 1), random_state=RANDOM_SEED)
        return svd.fit_transform(X)


def umap_embed(embeddings: np.ndarray) -> np.ndarray:
    n = embeddings.shape[0]
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=min(15, n - 1),
        min_dist=0.05,
        metric="cosine",
        random_state=RANDOM_SEED,
    )
    return reducer.fit_transform(embeddings)


def top_k_similar(embeddings: np.ndarray, video_ids: list[str], k: int = TOP_K) -> dict[str, list[dict]]:
    sim_matrix = embeddings @ embeddings.T
    np.fill_diagonal(sim_matrix, -1)

    result: dict[str, list[dict]] = {}
    for i, vid_id in enumerate(video_ids):
        top_indices = np.argpartition(sim_matrix[i], -k)[-k:]
        top_indices = top_indices[np.argsort(sim_matrix[i][top_indices])[::-1]]
        result[vid_id] = [
            {"video_id": video_ids[j], "similarity": round(float(sim_matrix[i, j]), 4)}
            for j in top_indices
        ]
    return result


def run_embeddings(df: pd.DataFrame) -> dict:
    titles = df["title"].tolist()
    video_ids = df["video_id"].tolist()

    tfidf_sim = tfidf_similarity(titles)
    embeddings = sentence_embeddings(titles)
    embedding_2d = umap_embed(embeddings)
    similarities = top_k_similar(embeddings, video_ids, k=TOP_K)

    top10_idx = df["views"].nlargest(10).index.tolist()
    top10_ids = [video_ids[i] for i in top10_idx]
    top10_titles = [titles[i] for i in top10_idx]
    tfidf_sample = tfidf_sim[np.ix_(top10_idx, top10_idx)]

    return {
        "umap_x": embedding_2d[:, 0].tolist(),
        "umap_y": embedding_2d[:, 1].tolist(),
        "similarities": similarities,
        "tfidf_sample": {
            "ids": top10_ids,
            "titles": top10_titles,
            "matrix": np.round(tfidf_sample, 4).tolist(),
        },
    }
