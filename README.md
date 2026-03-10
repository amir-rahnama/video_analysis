# Content Performance Insights Dashboard

A full-stack analytics dashboard for exploring video performance patterns across 1,000 kids content videos. Built as a senior ML engineer take-home exercise demonstrating layered analysis, clean architecture, and product-focused visualization.

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Apple M4 (MPS acceleration auto-detected; falls back to CPU on other hardware)

### 1. Backend

Use a virtual environment so dependencies stay isolated:

```bash
cd backend
python3 -m venv .venv

# Activate the venv:
#   macOS/Linux:
source .venv/bin/activate
#   Windows (PowerShell):
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn app:app --reload
```

The first startup takes ~1–2 minutes on M4 to run all analytics pipelines (ETL → clustering → trends → anomaly detection). Results are cached in-memory — all subsequent API requests are instant.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### How to run

**Backend** (from repo root):

```bash
cd backend
source .venv/bin/activate   # or: .venv\Scripts\Activate.ps1 on Windows
uvicorn app:app --reload
```

API is at [http://localhost:8000](http://localhost:8000). Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health).

**Frontend** (in a second terminal):

```bash
cd frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173). The frontend talks to the backend on port 8000; start the backend first.

---

## Approach & Methodology

Each analytical component is built in layers: a fast, interpretable baseline first, then increasing sophistication.

### Part 1: ETL (Data Processing)

**Layer 1 — Load & validate:** Strict dtype coercion, null detection, temporal fields (`days_since_publish`, `publish_month`, `publish_day_of_week`).

**Layer 2 — Derived metrics:**
- `avg_watch_time_per_view` = `watch_time_seconds / views`
- `engagement_rate` = `(likes + comments + shares) / views`
- `like_rate`, `comment_rate`, `share_rate` as independent signals
- `virality_score` = `(shares × 3 + likes) / views` — weighted toward shares as the strongest distribution signal

**Layer 3 — ML features:** Log-transform of `views` and `watch_time_seconds` (both heavily right-skewed). StandardScaler normalization exported for consistent inference.

### Part 2: Insights & Analysis (3 techniques)

#### Clustering
- **Layer 1:** 2-feature K-Means on `log_views` × `engagement_rate` (k=3) as an interpretable baseline.
- **Layer 2:** 6-feature K-Means on all derived metrics. k=6 chosen via elbow method (second derivative of inertia). Silhouette score: 0.185.
- **Layer 3:** UMAP 2D projection (15 neighbors, Euclidean metric) for scatter visualization. Clusters named post-hoc by centroid ranking: "Viral Stars", "Sleeper Hits", "High Reach", "Low Performers".

#### Trend Detection
- **Layer 1:** Pearson correlation matrix with p-values across all 8 numeric metrics.
- **Layer 2:** Per-category and per-thumbnail-style aggregation — which attributes correlate with higher shares or engagement?
- **Layer 3:** Monthly time series of avg engagement overlaid with publish volume; day-of-week publish analysis to detect temporal patterns.

#### Anomaly Detection
- **Layer 1:** Per-metric Z-scores (threshold: |z| > 2.5) to flag single-dimension outliers.
- **Layer 2:** Isolation Forest (200 trees, 8% contamination) on 6-feature normalized space — finds videos that are unusual across multiple dimensions simultaneously.
- **Layer 3:** Semantic classification — Isolation Forest flags the anomaly; Z-score direction determines the type: "Breakout" (high views, low engagement), "Underperformer" (high engagement, low views), "Watch Magnet" (outlier watch time), "Engagement Spike".

### Part 3: Dashboard

4-tab React dashboard with a global filter bar (category, thumbnail style, date range):

- **Overview:** KPIs, view distribution by category, engagement percentiles
- **Clusters:** UMAP scatter plot, cluster filter legend, per-cluster radar + stat cards
- **Trends:** Pearson correlation heatmap, category/thumbnail bars, monthly time series, day-of-week analysis
- **Anomalies:** Isolation Forest scatter, type-filtered table with anomaly score bars


---

---

## Design decisions (backend modules)

**`etl.py`** — We load the CSV with strict dtypes and drop rows that have nulls in views, watch time, or publish date so downstream math never sees missing or invalid numbers. All derived metrics (engagement rate, like/comment/share rates, virality score, avg watch time per view) are computed from raw counts and stored on the same DataFrame. We log-transform views and watch time, then pass a fixed set of six columns through StandardScaler so every ML step (clustering, anomaly) sees the same normalized feature space. The scaler and feature list are defined here so a single change propagates everywhere.

**`clustering.py`** — We use the same six normalized features from ETL for both K-Means and UMAP so the 2D plot reflects the same structure the clusters were fit on. The number of clusters is chosen automatically via an elbow on the inertia curve (second derivative), then clamped between 3 and 6 to avoid degenerate or noisy splits. UMAP is run with Euclidean metric and a fixed seed so the scatter is reproducible. Cluster names are assigned after the fact by ranking each cluster’s median views, engagement, and watch time and applying simple rules (e.g. high reach + high engagement → "Viral Stars", low reach + high engagement → "Sleeper Hits") so the dashboard shows readable labels instead of raw IDs.

**`trends.py`** — We compute a single Pearson correlation matrix over eight metrics (including virality and days since publish) and attach p-values via the t-distribution so the frontend can highlight which correlations are significant. Category and thumbnail breakdowns are plain groupby-aggregates (counts, means) so the API can reuse them when filters are applied. Monthly and day-of-week series are built from the same DataFrame so we get one consistent time axis for the dashboard. Top-performing category and thumbnail are derived by argmax on the same aggregates to keep "what works best" in one place.

**`anomaly.py`** — We treat Isolation Forest as the source of truth for *whether* a video is anomalous (200 trees, 8% contamination on the same six normalized features as clustering) and use Z-scores only to *label* the type. Z-scores are computed on four interpretable metrics (views, engagement rate, avg watch time, share rate) with a 2.5 threshold so we can say "high views, low engagement" → Breakout vs "low views, high engagement" → Underperformer. The combined anomaly score is a 0–1 rescaling of the decision function so the frontend can sort and display strength consistently. All of this runs on the global dataset (no per-request refit) so results are stable and fast to serve.

---

## Key Insights

### Correlation structure
- **Engagement rate and like rate are very tightly coupled** (r = 0.899) — in this dataset, likes dominate the engagement signal. Share rate adds independent variance (r = 0.418 with engagement).
- **Views are nearly uncorrelated with engagement rate** (r ≈ 0.0) — high reach and high engagement are independent dimensions. A video can go viral on views while having mediocre engagement, and vice versa. This validates the need for multi-dimensional clustering rather than a single "performance score."
- **Watch time per view is decoupled from all other metrics** — retention is its own signal, not predictable from engagement or reach alone.

### Clustering (k=6, silhouette=0.185)
The low silhouette score reflects the nature of this dataset: synthetic generation created smooth, overlapping distributions rather than sharp natural clusters. In real-world data you'd expect cleaner separation. The UMAP plot shows this as a dense central mass with gradient structure:
- **Viral Stars** (204 videos): high reach + high engagement — the ideal quadrant
- **Sleeper Hits** (83 videos): lower reach but above-average engagement — content that goes viral through retention, shares, and likes rather than raw views
- **High Reach** (169 videos): high views, average engagement — broad but shallow distribution
- **Low Performers** (263 videos): average-to-low on both dimensions

### Thumbnail & category effects
- **Bright thumbnails** lead on both share rate (1.13%) and overall engagement (4.45%) — contrast and vivid color attract clicks and shares
- **Minimal thumbnails** underperform on shares despite near-average engagement — suggest they retain viewers who click but are less shareable
- **Categories are near-parity** on engagement (~4.36–4.39%) and views (~1.26M–1.31M), consistent with the dataset being synthetically generated without category-based performance bias

### Anomaly detection
80 videos (8.0%) flagged by Isolation Forest — all classified as "Statistical Outlier" because the synthetic data's uniform distribution of engagement rates means no individual metric dimension produces clean Z-score extremes. In production data with organic viral events and algorithm boosts, you'd see clearly typed Breakout and Underperformer cases.

---

## Technical Decisions

**Python + FastAPI over Node.js:** The ML stack (scikit-learn, UMAP) is Python-native. FastAPI gives async routing with near-zero overhead and automatic OpenAPI docs.

**All analytics at startup, cached in-memory:** UMAP and clustering are expensive to run per-request. Computing once at startup then serving from memory keeps all API responses fast. A production system would persist results to a cache layer (Redis) or re-run nightly.

**UMAP over t-SNE:** UMAP preserves global structure better and is significantly faster at 1,000 points. The deterministic `random_state` seed makes projections reproducible.

**Recharts over D3 or Plotly:** Recharts integrates cleanly with React's component model, handles responsiveness natively, and covers all chart types needed here. D3 offers more control but requires much more code for the same output.

**Tailwind CSS:** Utility-first keeps the bundle small and component styles co-located — ideal for a time-boxed project.

---

## Given More Time

1. **Richer dataset:** Real YouTube Kids data with organic viral events, algorithm boost effects, and true engagement/view distributions would make clustering sharper and anomaly types more semantically meaningful.

2. **Time-series forecasting:** With 2+ years of data per channel, an ARIMA or Prophet model could predict next-month engagement from historical patterns.

3. **LLM-generated insights:** Wire the correlation and cluster data to an LLM to generate one-paragraph natural-language summaries ("Videos with bright thumbnails that feature animals in the title tend to over-perform on share rate by 15%...").

4. **Persist computed results:** Save cluster assignments and trend aggregates to disk (Parquet/SQLite) so the server starts instantly. Add a background re-computation job on a schedule.

5. **A/B testing framework:** Track which thumbnail styles perform better per category using Bayesian A/B testing (Beta-Binomial model) rather than simple averages.
