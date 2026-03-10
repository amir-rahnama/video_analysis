import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Line,
  ComposedChart, Area,
} from 'recharts';
import { useTrends } from '../hooks/useApi';
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

const THUMB_COLORS: Record<string, string> = {
  bright: '#f43f5e',
  cartoon: '#f59e0b',
  character_closeup: '#6366f1',
  colorful: '#10b981',
  minimal: '#22d3ee',
};

// Map internal column names to friendly labels
const CORR_LABELS: Record<string, string> = {
  views: 'Views',
  avg_watch_time_per_view: 'Watch Time',
  engagement_rate: 'Engagement',
  like_rate: 'Likes',
  comment_rate: 'Comments',
  share_rate: 'Shares',
  virality_score: 'Virality',
  days_since_publish: 'Age (days)',
};

function corrColor(r: number): string {
  if (r === 1) return '#1a1a2e';
  if (r > 0.6) return '#065f46';
  if (r > 0.3) return '#14532d';
  if (r > 0) return '#1a2e20';
  if (r > -0.3) return '#2e1a1a';
  if (r > -0.6) return '#5f0606';
  return '#7f1d1d';
}

function corrText(r: number): string {
  if (r > 0.3 || r < -0.3) return 'text-white font-semibold';
  return 'text-slate-400';
}

export function TrendView({ filters }: Props) {
  const { data, isLoading, error } = useTrends(filters);

  if (isLoading) return <Spinner label="Computing correlations…" />;
  if (error || !data) return <p className="text-red-400 p-8">Failed to load trend data.</p>;

  const { correlation, category_breakdown, thumbnail_breakdown, monthly_time_series, day_of_week, top_attributes } = data;

  return (
    <div className="space-y-8">
      {/* Top insight banner */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">Key Findings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Best Category (Engagement)', top_attributes.top_category_by_engagement],
            ['Best Category (Views)', top_attributes.top_category_by_views],
            ['Best Thumbnail (Shares)', top_attributes.top_thumbnail_by_shares],
            ['Best Thumbnail (Engagement)', top_attributes.top_thumbnail_by_engagement],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-slate-400 text-xs mb-1">{label}</p>
              <p className="text-white font-semibold capitalize">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Correlation matrix heatmap */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Pearson Correlation Matrix
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Pearson r across all 1,000 videos. Cells with |r| &gt; 0.3 are significant. Green = positive, red = negative correlation.
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full min-w-[520px]">
            <thead>
              <tr>
                <th className="p-2 text-left text-slate-500 font-normal w-28" />
                {correlation.columns.map((col) => (
                  <th key={col} className="p-1 text-slate-400 font-medium text-center rotate-0 whitespace-nowrap">
                    {CORR_LABELS[col] ?? col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlation.matrix.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 text-slate-400 font-medium whitespace-nowrap pr-4">
                    {CORR_LABELS[correlation.columns[i]] ?? correlation.columns[i]}
                  </td>
                  {row.map((val, j) => (
                    <td
                      key={j}
                      className={`p-2 text-center rounded font-mono transition-colors ${corrText(val)}`}
                      style={{ background: corrColor(val) }}
                      title={`${CORR_LABELS[correlation.columns[i]]} × ${CORR_LABELS[correlation.columns[j]]}: r=${val}`}
                    >
                      {i === j ? '—' : val.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category breakdown bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Avg Engagement by Category
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={category_breakdown} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
              <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${((v as number) * 100).toFixed(2)}%`, 'Avg Engagement']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="avg_engagement" radius={[4, 4, 0, 0]}>
                {category_breakdown.map(({ category }) => (
                  <Cell key={category} fill={CATEGORY_COLORS[category] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Avg Share Rate by Thumbnail Style
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={thumbnail_breakdown} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
              <XAxis dataKey="thumbnail_style" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${((v as number) * 100).toFixed(2)}%`, 'Avg Share Rate']}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="avg_share_rate" radius={[4, 4, 0, 0]}>
                {thumbnail_breakdown.map(({ thumbnail_style }) => (
                  <Cell key={thumbnail_style} fill={THUMB_COLORS[thumbnail_style] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly time series */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
          Monthly Avg Engagement Rate Over Time
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={monthly_time_series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
            <XAxis
              dataKey="publish_month"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              interval={2}
            />
            <YAxis
              yAxisId="engagement"
              tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fill: '#64748b', fontSize: 10 }}
            />
            <Tooltip
              formatter={(v, name) => {
                if (name === 'avg_engagement') return [`${((v as number) * 100).toFixed(2)}%`, 'Avg Engagement'];
                if (name === 'count') return [v as number, 'Videos Published'];
                return [v as number, name as string];
              }}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Area
              yAxisId="count"
              type="monotone"
              dataKey="count"
              fill="#2d2d4e"
              stroke="transparent"
            />
            <Line
              yAxisId="engagement"
              type="monotone"
              dataKey="avg_engagement"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: '#6366f1' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500 mt-2">
          Grey area = number of videos published that month. Line = avg engagement rate.
        </p>
      </div>

      {/* Day of week analysis */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
          Avg Engagement by Publish Day
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={day_of_week} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4e" />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              formatter={(v) => [`${((v as number) * 100).toFixed(2)}%`, 'Avg Engagement']}
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Bar dataKey="avg_engagement" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500 mt-2">
          Is there a best day to publish? This chart shows if weekend or weekday releases perform differently.
        </p>
      </div>
    </div>
  );
}
