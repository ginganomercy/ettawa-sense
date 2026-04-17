'use client';

import { useSocket } from '@/context/SocketContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const LINES = [
  { key: 'x', color: '#0891b2' },
  { key: 'y', color: '#059669' },
  { key: 'z', color: '#7c3aed' },
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-2 text-xs shadow-lg">
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.dataKey.toUpperCase()}:</span>
          <span className="text-slate-800 font-bold">{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AccelChart() {
  const { accelHistory } = useSocket();
  const data = accelHistory.map((pt, i) => ({ i, x: pt.x, y: pt.y, z: pt.z }));

  return (
    <div className="glass-card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="card-label">Akselerometer</span>
        <span className="text-[10px] text-slate-400 shrink-0">{accelHistory.length} titik</span>
      </div>

      {/* Legend */}
      <div className="flex gap-2">
        {LINES.map(({ key, color }) => (
          <div key={key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs text-slate-500 font-semibold">{key.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {accelHistory.length === 0 ? (
        <div className="flex items-center justify-center h-28 text-slate-400 text-xs">
          ⏳ Menunggu data ESP32...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="i" tick={false} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} tick={{ fill: '#cbd5e1', fontSize: 9 }}
              axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {LINES.map(({ key, color }) => (
              <Line key={key} type="monotone" dataKey={key} stroke={color}
                strokeWidth={1.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
