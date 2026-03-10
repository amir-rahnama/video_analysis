import { useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, BarChart, Bar,
} from 'recharts';
import { useAnomalies } from '../hooks/useApi';
import { Spinner } from './Spinner';
import type { AnomalyVideo, AnomalyScorePoint } from '../types/api';

const TYPE_COLORS: Record<string, string> = {
  Breakout: '#10b981',
  Underperformer: '#f43f5e',
  'Watch Magnet': '#6366f1',
  'Engagement Spike': '#f59e0b',
  'Statistical Outlier': '#94a3b8',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  Breakout: 'Viral surprise — far more views than engagement level predicts',
  Underperformer: 'Hidden gem — strong engagement signals but low view count',
  'Watch Magnet': 'Unusually long average watch time for its reach',
  'Engagement Spike': 'Extreme engagement rate relative to its view tier',
  'Statistical Outlier': 'Statistically extreme on multiple dimensions',
};

function AnomalyBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: color + '22', color, border: `1px solid ${color}55` }}
    >
      {type}
    </span>
  );
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: AnomalyScorePoint }>;
}

function ScatterTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#13132a] border border-[#2d2d4e] rounded-lg p-3 text-xs shadow-xl">
      <p className="text-white font-semibold mb-1">{d.video_id}</p>
      <p className="text-slate-400">Views: <span className="text-white">{fmtViews(d.views)}</span></p>
      <p className="text-slate-400">Engagement: <span className="text-white">{(d.engagement_rate * 100).toFixed(2)}%</span></p>
      <p className="text-slate-400">Anomaly Score: <span className="text-white">{d.anomaly_score.toFixed(3)}</span></p>
      {d.anomaly_type && (
        <p className="text-slate-400">Type: <span style={{ color: TYPE_COLORS[d.anomaly_type] ?? '#94a3b8' }}>{d.anomaly_type}</span></p>
      )}
    </div>
  );
}

export function AnomalyView() {
  const { data, isLoading, error } = useAnomalies();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  if (isLoading) return <Spinner label="Running Isolation Forest…" />;
  if (error || !data) return <p className="text-red-400 p-8">Failed to load anomaly data.</p>;

  const filteredAnomalies: AnomalyVideo[] = selectedType
    ? data.anomalies.filter((a) => a.anomaly_type === selectedType)
    : data.anomalies;

  const pageData = filteredAnomalies.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredAnomalies.length / PAGE_SIZE);

  return (
    <div className="space-y-8">
      {/* Methodology card */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">How It Works</h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-3">
          Two-layer anomaly detection: <strong className="text-white">Isolation Forest</strong> (200 trees, 8% contamination)
          trained on 6 normalized performance features to find globally unusual videos, combined with
          per-metric <strong className="text-white">Z-scores</strong> (|z| &gt; 2.5) for semantic classification.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(TYPE_DESCRIPTIONS).map(([type, desc]) => (
            <div key={type} className="flex flex-col gap-1">
              <AnomalyBadge type={type} />
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Total Anomalies</p>
          <p className="text-3xl font-bold text-white mt-1">{data.total_anomalies}</p>
          <p className="text-xs text-slate-500">{(data.contamination_rate * 100).toFixed(1)}% of corpus</p>
        </div>
        {data.summary.slice(0, 3).map(({ type, count }) => (
          <div key={type} className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-widest">{type}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: TYPE_COLORS[type] ?? '#fff' }}>{count}</p>
            <p className="text-xs text-slate-500">videos flagged</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Anomaly type distribution */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Anomaly Type Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.summary} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.summary.map(({ type }) => (
                  <Cell key={type} fill={TYPE_COLORS[type] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Anomaly score scatter: views vs engagement, colored by anomaly */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Anomaly Score: Views vs Engagement
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis
                dataKey="views"
                type="number"
                name="Views"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={fmtViews}
              />
              <YAxis
                dataKey="engagement_rate"
                type="number"
                name="Engagement"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={data.all_scores} name="Videos">
                {data.all_scores.map((pt, i) => (
                  <Cell
                    key={i}
                    fill={
                      pt.is_anomaly
                        ? (TYPE_COLORS[pt.anomaly_type ?? ''] ?? '#f59e0b')
                        : '#2d2d4e'
                    }
                    opacity={pt.is_anomaly ? 0.9 : 0.4}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">
            Colored dots are anomalies. Dark dots are normal videos.
          </p>
        </div>
      </div>

      {/* Anomaly table */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Flagged Videos ({filteredAnomalies.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedType(null); setPage(0); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !selectedType ? 'bg-white text-black border-white' : 'border-[#2d2d4e] text-slate-400'
              }`}
            >
              All
            </button>
            {data.summary.map(({ type }) => (
              <button
                key={type}
                onClick={() => { setSelectedType(selectedType === type ? null : type); setPage(0); }}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                style={{
                  borderColor: TYPE_COLORS[type],
                  background: selectedType === type ? TYPE_COLORS[type] + '33' : 'transparent',
                  color: selectedType === type ? TYPE_COLORS[type] : '#94a3b8',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2d2d4e]">
                {['#', 'Title', 'Category', 'Views', 'Engagement', 'Watch Time', 'Share Rate', 'Anomaly Score', 'Type'].map(h => (
                  <th key={h} className="text-left pb-3 pr-4 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((video, i) => (
                <tr key={video.video_id} className="border-b border-[#1e1e38] hover:bg-[#13132a] transition-colors">
                  <td className="py-3 pr-4 text-slate-500 font-mono">{page * PAGE_SIZE + i + 1}</td>
                  <td className="py-3 pr-4 text-white max-w-[200px] truncate" title={video.title}>{video.title}</td>
                  <td className="py-3 pr-4 text-slate-300 capitalize">{video.category}</td>
                  <td className="py-3 pr-4 font-mono text-white">{fmtViews(video.views)}</td>
                  <td className="py-3 pr-4 font-mono text-cyan-400">{(video.engagement_rate * 100).toFixed(2)}%</td>
                  <td className="py-3 pr-4 font-mono text-slate-300">{Math.round(video.avg_watch_time_per_view)}s</td>
                  <td className="py-3 pr-4 font-mono text-slate-300">{(video.share_rate * 100).toFixed(2)}%</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.round(video.anomaly_score * 60)}px`,
                          background: TYPE_COLORS[video.anomaly_type] ?? '#94a3b8',
                        }}
                      />
                      <span className="font-mono text-slate-400">{video.anomaly_score.toFixed(3)}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4"><AnomalyBadge type={video.anomaly_type} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border border-[#2d2d4e] text-slate-400 text-xs disabled:opacity-30 hover:border-brand-500 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs text-slate-400">Page {page + 1} / {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-[#2d2d4e] text-slate-400 text-xs disabled:opacity-30 hover:border-brand-500 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
