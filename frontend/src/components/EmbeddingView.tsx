import { useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useEmbeddings } from '../hooks/useApi';
import { Spinner } from './Spinner';
import type { EmbeddingPoint } from '../types/api';

const CATEGORY_COLORS: Record<string, string> = {
  animation: '#6366f1',
  education: '#22d3ee',
  entertainment: '#f59e0b',
};

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: EmbeddingPoint & { selected?: boolean } }>;
}

function EmbedTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#13132a] border border-[#2d2d4e] rounded-lg p-3 text-xs shadow-xl max-w-xs">
      <p className="font-semibold text-white mb-1 truncate">{d.title}</p>
      <p className="text-slate-400">Category: <span className="text-white capitalize">{d.category}</span></p>
      <p className="text-slate-400">Views: <span className="text-white">{fmtViews(d.views)}</span></p>
      <p className="text-slate-400">Engagement: <span className="text-white">{(d.engagement_rate * 100).toFixed(2)}%</span></p>
      <p className="text-xs text-brand-500 mt-1">Click to see similar videos →</p>
    </div>
  );
}

export function EmbeddingView() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);
  const { data, isLoading, error } = useEmbeddings(selectedVideoId);

  if (isLoading) return <Spinner label="Computing semantic embeddings…" />;
  if (error || !data) return <p className="text-red-400 p-8">Failed to load embedding data.</p>;

  const categories = [...new Set(data.points.map(p => p.category))];

  const selectedPoint = selectedVideoId
    ? data.points.find(p => p.video_id === selectedVideoId)
    : null;

  // Build a lookup from video_id to title for similarity results
  const idToTitle = Object.fromEntries(data.points.map(p => [p.video_id, p.title]));
  const idToCategory = Object.fromEntries(data.points.map(p => [p.video_id, p.category]));

  return (
    <div className="space-y-8">
      {/* Methodology */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">How It Works</h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          Video titles are encoded with <strong className="text-white">all-MiniLM-L6-v2</strong> (a sentence-transformer
          model, accelerated via Apple MPS on M4), producing 384-dimensional semantic embeddings.
          UMAP reduces these to 2D using cosine distance, so titles with similar
          themes cluster together. Cosine similarity identifies the top-5 most semantically
          related videos for any selected video — useful for content recommendation and gap analysis.
          A TF-IDF baseline (bigrams) provides a fast lexical comparison layer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main scatter */}
        <div className="lg:col-span-2 bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Semantic Embedding Space (UMAP)
            </h3>
            <div className="flex gap-3">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: CATEGORY_COLORS[cat] ?? '#888' }}
                  />
                  <span className="capitalize">{cat}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Click any point to see its top-5 most semantically similar videos.
          </p>
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              onClick={(e: Record<string, unknown>) => {
                const payload = (e?.activePayload as Array<{ payload: EmbeddingPoint }> | undefined)?.[0]?.payload;
                if (payload) {
                  setSelectedVideoId(prev => prev === payload.video_id ? undefined : payload.video_id);
                }
              }}
            >
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
              <Tooltip content={<EmbedTooltip />} cursor={{ stroke: '#4338ca' }} />
              <Scatter data={data.points} name="Videos">
                {data.points.map((pt, i) => {
                  const isSelected = pt.video_id === selectedVideoId;
                  const isSimilar = data.similar_to?.top_similar.some(s => s.video_id === pt.video_id);
                  const color = CATEGORY_COLORS[pt.category] ?? '#888';
                  return (
                    <Cell
                      key={i}
                      fill={isSelected ? '#fff' : isSimilar ? '#fbbf24' : color}
                      opacity={
                        selectedVideoId
                          ? isSelected ? 1 : isSimilar ? 0.95 : 0.15
                          : 0.75
                      }
                      strokeWidth={isSelected ? 2 : isSimilar ? 1 : 0}
                      stroke={isSelected ? '#fff' : isSimilar ? '#fbbf24' : 'none'}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Similarity panel */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Similar Videos
          </h3>

          {!selectedVideoId && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-sm gap-2">
              <div className="text-4xl opacity-30">⬤</div>
              <p>Click any point on the scatter plot to see its top-5 semantically similar videos.</p>
            </div>
          )}

          {selectedPoint && (
            <>
              <div className="border border-brand-500/40 bg-brand-500/10 rounded-lg p-3">
                <p className="text-xs text-brand-500 uppercase tracking-widest mb-1">Selected</p>
                <p className="text-white text-sm font-semibold leading-snug">{selectedPoint.title}</p>
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                  <span className="capitalize">{selectedPoint.category}</span>
                  <span>{fmtViews(selectedPoint.views)} views</span>
                  <span>{(selectedPoint.engagement_rate * 100).toFixed(2)}% eng.</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Top 5 Similar</p>
                {data.similar_to?.top_similar.map((sim, i) => {
                  const title = idToTitle[sim.video_id] ?? sim.video_id;
                  const cat = idToCategory[sim.video_id] ?? '';
                  const color = CATEGORY_COLORS[cat] ?? '#888';
                  return (
                    <div
                      key={sim.video_id}
                      className="flex items-start gap-3 py-2.5 border-b border-[#2d2d4e] cursor-pointer hover:bg-[#13132a] transition-colors rounded px-1"
                      onClick={() => setSelectedVideoId(sim.video_id)}
                    >
                      <span className="text-slate-500 font-mono text-xs w-4 flex-shrink-0 pt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs leading-snug truncate" title={title}>{title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                          <span className="text-slate-500 text-xs capitalize">{cat}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-mono text-emerald-400">{(sim.similarity * 100).toFixed(0)}%</p>
                        <p className="text-xs text-slate-500">match</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setSelectedVideoId(undefined)}
                className="mt-auto text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
              >
                ✕ Clear selection
              </button>
            </>
          )}
        </div>
      </div>

      {/* TF-IDF sample heatmap */}
      <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-1">
          TF-IDF Title Similarity — Top 10 Videos by Views
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Lexical (bigram) cosine similarity between the 10 most-viewed video titles. Compare with
          semantic UMAP above to see where word overlap vs meaning diverge.
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-28 p-1" />
                {data.tfidf_sample.titles.map((t, i) => (
                  <th
                    key={i}
                    className="p-1 text-slate-400 font-normal text-center"
                    style={{ fontSize: 9, maxWidth: 60, overflow: 'hidden' }}
                    title={t}
                  >
                    <span className="block truncate max-w-[56px]">{t.split(' ').slice(0, 2).join(' ')}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.tfidf_sample.matrix.map((row, i) => (
                <tr key={i}>
                  <td
                    className="p-1 text-slate-400 text-right pr-3 whitespace-nowrap"
                    style={{ fontSize: 9, maxWidth: 112 }}
                    title={data.tfidf_sample.titles[i]}
                  >
                    <span className="block truncate max-w-[110px]">
                      {data.tfidf_sample.titles[i].split(' ').slice(0, 2).join(' ')}
                    </span>
                  </td>
                  {row.map((val, j) => {
                    const bg = i === j ? '#2d2d4e' : val > 0.3 ? '#065f46' : val > 0.1 ? '#1a2e20' : '#13132a';
                    return (
                      <td
                        key={j}
                        className="p-1 text-center font-mono rounded"
                        style={{ background: bg, color: val > 0.3 ? '#fff' : '#64748b', fontSize: 9, minWidth: 36 }}
                      >
                        {i === j ? '—' : val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
