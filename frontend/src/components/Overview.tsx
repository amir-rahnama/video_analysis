import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts';
import { useOverview } from '../hooks/useApi';
import { Spinner } from './Spinner';
import type { Filters } from '../types/api';

interface Props {
  filters: Partial<Filters>;
}

const CATEGORY_COLORS: Record<string, string> = {
  animation: '#6366f1',
  education: '#22d3ee',
  entertainment: '#f59e0b',
};

const THUMB_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e'];

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-5 flex flex-col gap-1 hover:border-brand-500 transition-colors">
      <span className="text-xs font-medium uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-3xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

function fmtViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
}

export function Overview({ filters }: Props) {
  const { data, isLoading, error } = useOverview(filters);

  if (isLoading) return <Spinner label="Loading overview…" />;
  if (error || !data) return <p className="text-red-400 p-8">Failed to load overview.</p>;

  const engagementPct = (data.avg_engagement_rate * 100).toFixed(2);
  const sharePct = (data.avg_share_rate * 100).toFixed(2);

  // Pie chart for category distribution
  const categoryData = data.category_view_totals.map(({ category, total_views }) => ({
    name: category,
    value: total_views,
    color: CATEGORY_COLORS[category] ?? '#888',
  }));

  // Engagement distribution bar
  const engDist = [
    { label: 'P25', value: +(data.engagement_distribution.p25 * 100).toFixed(2) },
    { label: 'Median', value: +(data.engagement_distribution.p50 * 100).toFixed(2) },
    { label: 'P75', value: +(data.engagement_distribution.p75 * 100).toFixed(2) },
    { label: 'P90', value: +(data.engagement_distribution.p90 * 100).toFixed(2) },
  ];

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Videos"
          value={data.total_videos.toLocaleString()}
          sub={`${data.date_min} → ${data.date_max}`}
        />
        <KpiCard
          label="Total Views"
          value={fmtViews(data.total_views)}
          sub={`Avg ${fmtViews(data.avg_views)} per video`}
          accent="text-brand-500"
        />
        <KpiCard
          label="Avg Engagement"
          value={`${engagementPct}%`}
          sub="(likes + comments + shares) / views"
          accent="text-cyan-400"
        />
        <KpiCard
          label="Avg Watch Time"
          value={fmtSecs(data.avg_watch_time_per_view)}
          sub="per view"
          accent="text-amber-400"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Share Rate"
          value={`${sharePct}%`}
          sub="shares / views"
          accent="text-emerald-400"
        />
        <KpiCard
          label="Top Category"
          value={data.top_category_by_engagement}
          sub="by avg engagement rate"
          accent="text-rose-400"
        />
        <KpiCard
          label="Best Thumbnail"
          value={data.top_thumbnail_by_shares}
          sub="by avg share rate"
        />
        <KpiCard
          label="Date Range"
          value={`${data.total_videos}`}
          sub={`videos from ${data.date_min} to ${data.date_max}`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category views pie */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Total Views by Category
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [fmtViews(v as number), 'Views']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement distribution */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Engagement Rate Distribution (%)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={engDist} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Engagement']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {engDist.map((_, i) => (
                  <Cell key={i} fill={THUMB_COLORS[i % THUMB_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">
            50% of videos have engagement rate below {(data.engagement_distribution.p50 * 100).toFixed(2)}% — top 10% exceed {(data.engagement_distribution.p90 * 100).toFixed(2)}%.
          </p>
        </div>
      </div>

      {/* Category breakdown bar chart */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
          Views Per Category
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.category_view_totals} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
            <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tickFormatter={fmtViews} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip
              formatter={(v) => [fmtViews(v as number), 'Total Views']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Bar dataKey="total_views" radius={[4, 4, 0, 0]}>
              {data.category_view_totals.map(({ category }) => (
                <Cell key={category} fill={CATEGORY_COLORS[category] ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
