'use client';

import { useSocket } from '@/context/SocketContext';

export default function DeviceStatus() {
  const { deviceStatus, wsConnected, mqttConnected, telemetry } = useSocket();

  const uptimeStr = (s) => {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="card-label">Perangkat</span>
        <span className={`badge ${deviceStatus.online ? 'badge-online' : 'badge-offline'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${deviceStatus.online ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
          {deviceStatus.online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Device ID */}
      <div className="w-full min-w-0">
        <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">
          {telemetry?.device_id ?? 'ettawa-collar-01'}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">collar/01/#</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="WebSocket"  value={wsConnected   ? 'OK' : 'Putus'} ok={wsConnected} />
        <StatBox label="MQTT"       value={mqttConnected ? 'OK' : 'Putus'} ok={mqttConnected} />
        <StatBox label="Uptime"     value={uptimeStr(telemetry?.uptime_s)} neutral />
        <StatBox label="Status"     value={telemetry ? 'Live ●' : 'Menunggu'} ok={!!telemetry} />
      </div>
    </div>
  );
}

function StatBox({ label, value, ok, neutral = false }) {
  const color = neutral ? 'text-slate-700' : ok ? 'text-teal-600' : 'text-red-500';
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex flex-col justify-center min-w-0">
      <p className="text-[9px] text-slate-400 truncate">{label}</p>
      <p className={`text-[11px] font-bold mt-0.5 truncate ${color}`}>{value}</p>
    </div>
  );
}
