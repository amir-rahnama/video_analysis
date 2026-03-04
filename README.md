# Take-Home Technical Test – Data Analytics

## "Content Performance Insights Dashboard"

**Time estimate**: 2-3 hours
**Delivery**: GitHub repo with README

---

## The Problem:

You’re provided a dataset of video performance metrics (CSV or JSON). Build a simple web application that:

1. **Ingests and processes the data** (basic ETL)
2. **Applies ML/analytics** to surface insights
3. **Visualizes findings** in an interactive dashboard

**The goal**: Show us how you think about data, build products, and communicate insights.

---

## Dataset Provided:

See `sample_videos.csv`:

```csv
video_id,title,category,publish_date,views,watch_time_seconds,likes,comments,shares,thumbnail_style
v001,Brave Cookie Chaos #1,education,2024-12-18,289962,41464566,3131,812,792,colorful
v002,Magic Kitten Mystery #2,entertainment,2024-11-14,2355492,223771740,76388,9842,30376,minimal
v003,Rainbow Kitten Heroes #3,education,2023-01-19,1061621,317424679,24133,5262,2871,cartoon
```

---

## Requirements:

### Part 1: Data Processing (30%)
- Load and clean the data
- Calculate derived metrics (e.g., engagement rate, avg watch time per view)
- Basic validation/error handling

### Part 2: Insights & Analysis (40%)
Choose **at least 2** of these:
- **Clustering**: Group videos by performance patterns (high engagement vs high reach vs etc)
- **Trend detection**: Identify what content attributes correlate with performance
- **Embeddings**: Use text embeddings on titles to find similar high-performing content
- **Anomaly detection**: Flag outlier videos (unexpectedly good or bad performance)

### Part 3: Visualization (30%)
Build a simple web dashboard that shows:
- Overview metrics (total views, avg engagement, etc.)
- Your analysis findings (charts, clusters, recommendations)
- Interactive elements (filter by category, date range, etc.)

---

## Technical Constraints:

- **Backend**: Python or Node.js (your choice)
- **Frontend**: React (any framework/setup you prefer)
- **Data/ML**: Any libraries (pandas, scikit-learn, OpenAI APIs, etc.)
- **No database required**: In-memory or file-based is fine
- **Deployment**: Not required, just run locally

---

## What We’re Looking For:

✅ **Clear thinking**: Can you identify meaningful patterns?  
✅ **Product sense**: Does your dashboard answer useful questions?  
✅ **Code quality**: Clean, readable, documented  
✅ **Communication**: Good README explaining your approach and findings  
✅ **Pragmatism**: Balanced polish vs getting it done in ~4 hours

**Not looking for**: Perfect ML models, production deployment, extensive testing

---

## Deliverables:

1. **GitHub repo** with:
   - Source code
   - README with:
     - Setup instructions
     - Your approach/methodology
     - Key insights you found
     - What you'd improve with more time
   - Sample screenshots (if dashboard doesn't run easily)
2. **Optional**: Short video walkthrough (2-3 min Loom)

---

## README Template for the deliverable:

```markdown
# Content Performance Insights

## Setup
[How to run your code]

## Approach
[What techniques did you use and why?]

## Key Insights
[What patterns did you find in the data?]

## Technical Decisions
[Why did you choose X over Y?]

## Given More Time
[What would you add/improve?]
```
