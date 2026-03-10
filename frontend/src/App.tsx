import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOverview } from './hooks/useApi';
import { Overview } from './components/Overview';
import { ClusterView } from './components/ClusterView';
import { TrendView } from './components/TrendView';
import { AnomalyView } from './components/AnomalyView';
import type { Filters } from './types/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
});

const TABS = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'clusters', label: 'Clusters', icon: '◈' },
  { id: 'trends', label: 'Trends', icon: '∿' },
  { id: 'anomalies', label: 'Anomalies', icon: '⚑' },
] as const;

type TabId = typeof TABS[number]['id'];

function FilterBar({
  filters,
  onFiltersChange,
}: {
  filters: Partial<Filters>;
  onFiltersChange: (f: Partial<Filters>) => void;
}) {
  const { data } = useOverview({});  // always fetch unfiltered for dropdown options

  const set = (k: keyof Filters, v: string) =>
    onFiltersChange({ ...filters, [k]: v || undefined });

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-[#13132a] border-b border-[#2d2d4e]">
      <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Filters</span>

      <select
        value={filters.category ?? ''}
        onChange={(e) => set('category', e.target.value)}
        className="bg-[#1a1a2e] border border-[#2d2d4e] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:border-brand-500 outline-none transition-colors"
      >
        <option value="">All Categories</option>
        {(data?.categories ?? ['animation', 'education', 'entertainment']).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={filters.thumbnail_style ?? ''}
        onChange={(e) => set('thumbnail_style', e.target.value)}
        className="bg-[#1a1a2e] border border-[#2d2d4e] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:border-brand-500 outline-none transition-colors"
      >
        <option value="">All Thumbnails</option>
        {(data?.thumbnail_styles ?? ['bright', 'cartoon', 'character_closeup', 'colorful', 'minimal']).map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={filters.date_from ?? ''}
          onChange={(e) => set('date_from', e.target.value)}
          className="bg-[#1a1a2e] border border-[#2d2d4e] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:border-brand-500 outline-none transition-colors"
        />
        <span className="text-slate-500 text-xs">→</span>
        <input
          type="date"
          value={filters.date_to ?? ''}
          onChange={(e) => set('date_to', e.target.value)}
          className="bg-[#1a1a2e] border border-[#2d2d4e] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:border-brand-500 outline-none transition-colors"
        />
      </div>

      {(filters.category || filters.thumbnail_style || filters.date_from || filters.date_to) && (
        <button
          onClick={() => onFiltersChange({})}
          className="text-xs text-brand-500 hover:text-brand-400 transition-colors ml-1"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [filters, setFilters] = useState<Partial<Filters>>({});

  const filterSensitiveTabs = new Set(['overview', 'clusters', 'trends']);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0a18] border-b border-[#2d2d4e] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Content Performance Insights
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            1,000 videos · 3 ML techniques · real-time filters
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Backend live
        </div>
      </header>

      {/* Tab bar */}
      <nav className="bg-[#0d0d1f] border-b border-[#2d2d4e] px-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="opacity-70">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Filter bar — shown only for filter-sensitive tabs */}
      {filterSensitiveTabs.has(activeTab) && (
        <FilterBar filters={filters} onFiltersChange={setFilters} />
      )}

      {/* Main content */}
      <main className="flex-1 px-6 py-8 max-w-[1400px] w-full mx-auto">
        {activeTab === 'overview' && <Overview filters={filters} />}
        {activeTab === 'clusters' && (
          <ClusterView
            category={filters.category}
            thumbnailStyle={filters.thumbnail_style}
          />
        )}
        {activeTab === 'trends' && <TrendView filters={filters} />}
        {activeTab === 'anomalies' && <AnomalyView />}
      </main>

      <footer className="border-t border-[#2d2d4e] px-6 py-3 text-xs text-slate-600 text-center">
        Built with FastAPI · scikit-learn · UMAP · React · Recharts
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
