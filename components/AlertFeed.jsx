'use client';

import { useSocket } from '@/context/SocketContext';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}d lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  return `${Math.floor(diff / 3600)}j lalu`;
}

const LEVEL_STYLE = {
  STRESS:  { border: '#fca5a5', bg: '#fff5f5', dot: '#ef4444', textColor: '#dc2626' },
  WARNING: { border: '#fde68a', bg: '#fffbeb', dot: '#f59e0b', textColor: '#d97706' },
  NORMAL:  { border: '#a7f3d0', bg: '#f0fdf4', dot: '#10b981', textColor: '#059669' },
};

export default function AlertFeed() {
  const { alerts } = useSocket();

  return (
    <div className="glass-card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="card-label">Riwayat Alert</span>
        {alerts.length > 0 && (
          <span className="badge badge-stress">{alerts.length}</span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="text-3xl">✅</span>
          <p className="text-sm text-slate-400">Tidak ada alert — kondisi normal</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto">
          {alerts.map((a, i) => {
            const s = LEVEL_STYLE[a.stress_level] ?? LEVEL_STYLE.NORMAL;
            return (
              <li
                key={i}
                className="rounded-2xl p-3 flex flex-col gap-1 fade-in-up"
                style={{
                  background:   s.bg,
                  border:       `1px solid ${s.border}`,
                  animationDelay: `${i * 40}ms`,
                  borderLeft:   `3px solid ${s.dot}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                    <span className="text-sm font-bold" style={{ color: s.textColor }}>
                      {a.stress_level}
                    </span>
                    <span className="text-xs text-slate-500">— {a.reason}</span>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(a.ts)}</span>
                </div>
                <div className="flex gap-3 text-xs text-slate-500 pl-4">
                  <span>Skor: <strong className="text-slate-700">{a.stress_score}</strong></span>
                  {a.temp_c && (
                    <span>Suhu: <strong className="text-slate-700">{parseFloat(a.temp_c).toFixed(1)}°C</strong></span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
