'use client';

import { useSocket } from '@/context/SocketContext';

export default function HeartRateCard() {
  const { bpm } = useSocket();

  return (
    <div className="glass-card p-3 flex flex-col justify-between h-full relative overflow-hidden group">
      <div className="flex items-center gap-2 relative z-10">
        <div className="min-w-[28px] h-7 rounded-lg flex items-center justify-center text-sm shadow-sm"
          style={{ background: 'linear-gradient(135deg, #ef4444, #be123c)', color: 'white' }}>
          💓
        </div>
        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Heart Rate</h2>
      </div>

      <div className="flex items-end gap-1.5 relative z-10 mt-2">
        <span className="text-3xl font-black text-rose-500 tabular-nums leading-none tracking-tight">
          {bpm ? bpm : '--'}
        </span>
        <span className="text-xs font-semibold text-rose-400 mb-0.5">BPM</span>
      </div>

      {bpm && (
        <div className="absolute top-3 right-3">
           <span className="flex h-2.5 w-2.5">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
           </span>
        </div>
      )}

      {/* Decorative pulse background */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all duration-700"></div>
    </div>
  );
}
