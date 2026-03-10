import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type {
  OverviewData,
  VideosResponse,
  ClustersResponse,
  TrendsResponse,
  AnomaliesResponse,
  Filters,
} from '../types/api';

const BASE = 'http://localhost:8000';

const api = axios.create({ baseURL: BASE });

function filtersToParams(f: Partial<Filters>) {
  const p: Record<string, string> = {};
  if (f.category) p.category = f.category;
  if (f.thumbnail_style) p.thumbnail_style = f.thumbnail_style;
  if (f.date_from) p.date_from = f.date_from;
  if (f.date_to) p.date_to = f.date_to;
  return p;
}

export function useOverview(filters: Partial<Filters>) {
  return useQuery<OverviewData>({
    queryKey: ['overview', filters],
    queryFn: () => api.get('/api/overview', { params: filtersToParams(filters) }).then(r => r.data),
    staleTime: Infinity,
  });
}

export function useVideos(
  filters: Partial<Filters>,
  sortBy = 'views',
  sortDir = 'desc',
  page = 1,
  limit = 50,
) {
  return useQuery<VideosResponse>({
    queryKey: ['videos', filters, sortBy, sortDir, page, limit],
    queryFn: () =>
      api.get('/api/videos', {
        params: { ...filtersToParams(filters), sort_by: sortBy, sort_dir: sortDir, page, limit },
      }).then(r => r.data),
    staleTime: Infinity,
  });
}

export function useClusters(category?: string, thumbnailStyle?: string) {
  return useQuery<ClustersResponse>({
    queryKey: ['clusters', category, thumbnailStyle],
    queryFn: () =>
      api.get('/api/clusters', {
        params: { ...(category ? { category } : {}), ...(thumbnailStyle ? { thumbnail_style: thumbnailStyle } : {}) },
      }).then(r => r.data),
    staleTime: Infinity,
  });
}

export function useTrends(filters: Partial<Filters>) {
  return useQuery<TrendsResponse>({
    queryKey: ['trends', filters],
    queryFn: () => api.get('/api/trends', { params: filtersToParams(filters) }).then(r => r.data),
    staleTime: Infinity,
  });
}

export function useAnomalies() {
  return useQuery<AnomaliesResponse>({
    queryKey: ['anomalies'],
    queryFn: () => api.get('/api/anomalies').then(r => r.data),
    staleTime: Infinity,
  });
}
