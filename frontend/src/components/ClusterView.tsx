import { useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from 'recharts';
import { useClusters } from '../hooks/useApi';
import { Spinner } from './Spinner';
import type { ClusterPoint, ClusterStat } from '../types/api';

// Distinct palette for up to 8 clusters
const CLUSTER_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981',
  '#f43f5e', '#a78bfa', '#fb923c', '#34d399',
];

interface Props {
  category?: string;
  thumbnailStyle?: string;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function ClusterCard({ stat, color }: { stat: ClusterStat; color: string }) {
  const radarData = [
    { metric: 'Reach', value: Math.min(stat.avg_views / 2_500_000, 1) },
    { metric: 'Engagement', value: Math.min(stat.avg_engagement / 0.06, 1) },
    { metric: 'Watch Time', value: Math.min(stat.avg_watch_time / 420, 1) },
    { metric: 'Virality', value: Math.min(stat.avg_share_rate / 0.02, 1) },
  ];

  return (
    <div
      className="bg-[#13132a] border rounded-xl p-4 flex flex-col gap-3 hover:border-opacity-80 transition-colors"
      style={{ borderColor: color + '55' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="font-semibold text-white text-sm">{stat.name}</span>
        <span className="ml-auto text-xs text-slate-400">{stat.count} videos</span>
      </div>

      <RadarChart cx="50%" cy="50%" outerRadius={55} width={160} height={130} data={radarData}>
        <PolarGrid stroke="#2d2d4e" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 9 }} />
        <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.25} />
      </RadarChart>

      <div className="grid grid-cols-2 gap-1 text-xs">
        <div>
          <span className="text-slate-400">Avg Views</span>
          <p className="font-mono text-white">{fmtViews(stat.avg_views)}</p>
        </div>
        <div>
          <span className="text-slate-400">Engagement</span>
          <p className="font-mono text-white">{(stat.avg_engagement * 100).toFixed(2)}%</p>
        </div>
        <div>
          <span className="text-slate-400">Watch Time</span>
          <p className="font-mono text-white">{Math.round(stat.avg_watch_time)}s</p>
        </div>
        <div>
          <span className="text-slate-400">Top Category</span>
          <p className="font-mono text-white capitalize">{stat.top_category}</p>
        </div>
      </div>
    </div>
  );
}

interface TooltipPayload {
  payload: ClusterPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#13132a] border border-[#2d2d4e] rounded-lg p-3 text-xs max-w-xs shadow-xl">
      <p className="font-semibold text-white mb-1 truncate">{d.title}</p>
      <p className="text-slate-400">Cluster: <span className="text-white">{d.cluster_name}</span></p>
      <p className="text-slate-400">Category: <span className="text-white capitalize">{d.category}</span></p>
      <p className="text-slate-400">Views: <span className="text-white">{fmtViews(d.views)}</span></p>
      <p className="text-slate-400">Engagement: <span className="text-white">{(d.engagement_rate * 100).toFixed(2)}%</span></p>
    </div>
  );
}

export function ClusterView({ category, thumbnailStyle }: Props) {
  const { data, isLoading, error } = useClusters(category, thumbnailStyle);
  const [hoveredCluster, setHoveredCluster] = useState<number | null>(null);

  if (isLoading) return <Spinner label="Running UMAP projection…" />;
  if (error || !data) return <p className="text-red-400 p-8">Failed to load cluster data.</p>;

  // Group points by cluster for separate Scatter series (needed for legend + color)
  const clusterGroups = new Map<number, ClusterPoint[]>();
  for (const pt of data.points) {
    if (!clusterGroups.has(pt.cluster)) clusterGroups.set(pt.cluster, []);
    clusterGroups.get(pt.cluster)!.push(pt);
  }

  const sortedClusters = Array.from(clusterGroups.keys()).sort();

  return (
    <div className="space-y-8">
      {/* Header insight */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">
          How It Works
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          K-Means clustering (k={data.elbow_k}, chosen via elbow method) groups videos by 6 performance
          dimensions: log-views, avg watch time, engagement rate, like rate, share rate, and comment rate.
          UMAP reduces these to 2D for visualization while preserving local structure.
          Each cluster is profiled and named by its centroid characteristics.
        </p>
      </div>

      {/* Cluster filter legend */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setHoveredCluster(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            hoveredCluster === null
              ? 'bg-white text-black border-white'
              : 'border-[#2d2d4e] text-slate-400 hover:border-slate-400'
          }`}
        >
          All Clusters
        </button>
        {sortedClusters.map((cid) => {
          const name = data.cluster_names[String(cid)] ?? `Cluster ${cid}`;
          const color = CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
          return (
            <button
              key={cid}
              onClick={() => setHoveredCluster(hoveredCluster === cid ? null : cid)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors`}
              style={{
                borderColor: color,
                background: hoveredCluster === cid ? color + '33' : 'transparent',
                color: hoveredCluster === cid ? color : '#94a3b8',
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* UMAP scatter plot */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
          UMAP Projection — Performance Space
        </h3>
        <ResponsiveContainer width="100%" height={480}>
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis
              dataKey="umap_x"
              type="number"
              name="UMAP-1"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: 'UMAP-1', position: 'bottom', fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              dataKey="umap_y"
              type="number"
              name="UMAP-2"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: 'UMAP-2', angle: -90, position: 'left', fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4338ca', strokeWidth: 1 }} />
            {sortedClusters.map((cid) => {
              const pts = clusterGroups.get(cid)!;
              const color = CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
              const dimmed = hoveredCluster !== null && hoveredCluster !== cid;
              return (
                <Scatter
                  key={cid}
                  name={data.cluster_names[String(cid)] ?? `Cluster ${cid}`}
                  data={pts}
                  fill={color}
                  opacity={dimmed ? 0.1 : pts[0]?.highlighted === false ? 0.3 : 0.75}
                >
                  {pts.map((pt, i) => (
                    <Cell
                      key={i}
                      fill={color}
                      opacity={
                        dimmed ? 0.05
                        : !pt.highlighted ? 0.2
                        : 0.8
                      }
                    />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Cluster profile cards */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
          Cluster Profiles
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.cluster_stats.map((stat) => (
            <ClusterCard
              key={stat.cluster}
              stat={stat}
              color={CLUSTER_COLORS[stat.cluster % CLUSTER_COLORS.length]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
