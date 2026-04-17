'use client';

import { useSocket } from '@/context/SocketContext';

const LEVEL_CONFIG = {
  NORMAL:  { bar: 'linear-gradient(90deg,#22d3ee,#34d399)', pct: null },
  WARNING: { bar: 'linear-gradient(90deg,#fbbf24,#f97316)', pct: null },
  STRESS:  { bar: 'linear-gradient(90deg,#f97316,#ef4444)', pct: null },
};

export default function StressCard() {
  const { telemetry } = useSocket();
  const score  = telemetry?.stress_score  ?? null;
  const level  = telemetry?.stress_level  ?? 'NORMAL';
  const reason = telemetry?.reason        ?? '—';
  const cfg    = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.NORMAL;
  const pct    = score !== null ? Math.min(100, Math.max(0, score)) : 0;

  const badgeClass = level === 'STRESS' ? 'badge-stress' : level === 'WARNING' ? 'badge-warning' : 'badge-normal';

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="card-label">Skor Stres</span>
        <span className={`badge ${badgeClass}`}>{level}</span>
      </div>

      {/* Score */}
      <div className="text-center py-0.5 flex items-baseline justify-center">
        <span
          className="text-3xl font-black leading-none"
          style={{
            background: cfg.bar,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: score !== null ? 'transparent' : undefined,
            color: score !== null ? 'transparent' : '#94a3b8',
          }}
        >
          {score !== null ? score : '—'}
        </span>
        <span className="text-slate-400 text-[10px] ml-0.5">/100</span>
      </div>

      {/* Bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: cfg.bar }}
        />
        <div className="absolute top-0 bottom-0 w-px bg-yellow-300" style={{ left:'50%' }} />
        <div className="absolute top-0 bottom-0 w-px bg-red-300"    style={{ left:'70%' }} />
      </div>

      {/* Reason */}
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex items-center gap-1 min-w-0">
        <span className="text-[10px] text-slate-400 shrink-0">Sebab:</span>
        <span className="text-[10px] font-bold text-teal-700 truncate">{reason}</span>
      </div>
    </div>
  );
}
