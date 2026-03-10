export interface OverviewData {
  total_videos: number;
  total_views: number;
  avg_views: number;
  avg_engagement_rate: number;
  avg_watch_time_per_view: number;
  avg_share_rate: number;
  top_category_by_engagement: string;
  top_thumbnail_by_shares: string;
  categories: string[];
  thumbnail_styles: string[];
  date_min: string;
  date_max: string;
  category_view_totals: Array<{ category: string; total_views: number }>;
  engagement_distribution: { p25: number; p50: number; p75: number; p90: number };
}

export interface VideoRecord {
  video_id: string;
  title: string;
  category: string;
  thumbnail_style: string;
  publish_date: string;
  views: number;
  avg_watch_time_per_view: number;
  engagement_rate: number;
  like_rate: number;
  comment_rate: number;
  share_rate: number;
  virality_score: number;
}

export interface VideosResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  data: VideoRecord[];
}

export interface ClusterPoint {
  video_id: string;
  title: string;
  category: string;
  thumbnail_style: string;
  views: number;
  engagement_rate: number;
  avg_watch_time_per_view: number;
  cluster: number;
  cluster_name: string;
  umap_x: number;
  umap_y: number;
  highlighted: boolean;
}

export interface ClusterStat {
  cluster: number;
  name: string;
  count: number;
  avg_views: number;
  avg_engagement: number;
  avg_watch_time: number;
  avg_share_rate: number;
  top_category: string;
}

export interface ClustersResponse {
  points: ClusterPoint[];
  cluster_stats: ClusterStat[];
  cluster_names: Record<string, string>;
  elbow_k: number;
}

export interface TrendsResponse {
  correlation: {
    columns: string[];
    matrix: number[][];
    pvalues: number[][];
  };
  category_breakdown: Array<{
    category: string;
    count: number;
    total_views: number;
    avg_views: number;
    avg_engagement: number;
    avg_watch_time: number;
    avg_share_rate: number;
    avg_like_rate: number;
    avg_virality: number;
  }>;
  thumbnail_breakdown: Array<{
    thumbnail_style: string;
    count: number;
    avg_views: number;
    avg_engagement: number;
    avg_share_rate: number;
    avg_like_rate: number;
    avg_watch_time: number;
  }>;
  category_thumbnail_heatmap: Array<{
    category: string;
    thumbnail_style: string;
    avg_engagement: number;
  }>;
  monthly_time_series: Array<{
    publish_month: string;
    total_views: number;
    avg_engagement: number;
    avg_virality: number;
    count: number;
  }>;
  day_of_week: Array<{
    day: string;
    count: number;
    avg_views: number;
    avg_engagement: number;
    avg_share_rate: number;
  }>;
  top_attributes: {
    top_category_by_engagement: string;
    top_category_by_views: string;
    top_thumbnail_by_shares: string;
    top_thumbnail_by_engagement: string;
  };
}

export interface AnomalyVideo {
  video_id: string;
  title: string;
  category: string;
  views: number;
  engagement_rate: number;
  avg_watch_time_per_view: number;
  share_rate: number;
  thumbnail_style: string;
  publish_date: string;
  if_score: number;
  anomaly_score: number;
  anomaly_type: string;
  zscore_outlier: boolean;
}

export interface AnomalyScorePoint {
  video_id: string;
  anomaly_score: number;
  is_anomaly: boolean;
  anomaly_type: string | null;
  views: number;
  engagement_rate: number;
}

export interface AnomaliesResponse {
  anomalies: AnomalyVideo[];
  all_scores: AnomalyScorePoint[];
  summary: Array<{ type: string; count: number }>;
  total_anomalies: number;
  contamination_rate: number;
}

export interface Filters {
  category: string;
  thumbnail_style: string;
  date_from: string;
  date_to: string;
}
