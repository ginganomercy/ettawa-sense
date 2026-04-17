'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

// Fungsi resolve URL agar bisa standalone / monolith
function getApiUrl(path) {
  if (typeof window === 'undefined') return path;
  // Jika NEXT_PUBLIC_BACKEND_URL beda dari localhost (di production misal), pakai origin itu
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && !envUrl.includes('localhost')) return `${envUrl}${path}`;
  // Default monolith development/cPanel: relative to same origin
  return path;
}

function formatHour(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryChart({ hours = 24 }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(getApiUrl(`/api/history?hours=${hours}`), {
      headers: {
        'x-api-key': API_KEY,
      }
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => { setData(json.data ?? []); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hours]);

  return (
    <div className="glass-card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="card-label">Trend {hours} Jam Terakhir</span>
        <span className="text-xs text-slate-400">{data.length} titik data</span>
      </div>

      {loading && (
        <div className="h-36 flex items-center justify-center text-slate-400 text-sm">
          ⏳ Memuat riwayat...
        </div>
      )}
      {error && (
        <div className="h-36 flex items-center justify-center text-red-400 text-sm">
          ⚠️ Gagal: {error}
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <div className="h-36 flex flex-col items-center justify-center gap-1 text-slate-400">
          <span className="text-2xl">📭</span>
          <span className="text-sm">Belum ada data riwayat tersimpan</span>
          <span className="text-xs text-slate-300">Data muncul saat InfluxDB dikonfigurasi</span>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0891b2" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradStress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="time" tickFormatter={formatHour}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} />
            <YAxis yAxisId="temp" orientation="left" domain={[28, 42]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} />
            <YAxis yAxisId="score" orientation="right" domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e0f2f1',
                borderRadius: 12,
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(8,145,178,0.10)',
              }}
              itemStyle={{ color: '#0f172a' }}
              labelFormatter={formatHour}
            />
            <Legend formatter={(v) => (
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {v === 'temp_c' ? 'Suhu (°C)' : 'Skor Stres'}
              </span>
            )} />
            <Area yAxisId="temp" type="monotone" dataKey="temp_c"
              stroke="#0891b2" strokeWidth={2} fill="url(#gradTemp)" dot={false} />
            <Area yAxisId="score" type="monotone" dataKey="stress_score"
              stroke="#059669" strokeWidth={2} fill="url(#gradStress)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
