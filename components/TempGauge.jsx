'use client';

import { useSocket } from '@/context/SocketContext';

const TEMP_MIN  = 28;
const TEMP_MAX  = 42;
const RADIUS    = 42;
const STROKE    = 7;
const ANGLE_GAP = 60;

function tempColor(t) {
  if (t == null) return '#cbd5e1';
  if (t > 40.0)  return '#ef4444';
  if (t > 39.5)  return '#f59e0b';
  if (t >= 38.0) return '#0891b2';
  return '#60a5fa';
}

function tempLabel(t) {
  if (t == null)  return '—';
  if (t > 40.0)   return 'FEVER';
  if (t > 39.5)   return 'BORDERLINE';
  if (t >= 38.0)  return 'NORMAL';
  return 'HYPOTHERMIA';
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const toRad = (d) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function TempGauge() {
  const { telemetry, isMockTemp } = useSocket();
  const temp  = telemetry ? parseFloat(telemetry.temp_c) : null;
  const color = tempColor(temp);
  const label = tempLabel(temp);

  const cx = 55, cy = 55;
  const START_ANGLE = 90 + ANGLE_GAP / 2;
  const ARC_SWEEP   = 360 - ANGLE_GAP;
  const clampedTemp = temp != null ? Math.min(TEMP_MAX, Math.max(TEMP_MIN, temp)) : TEMP_MIN;
  const fraction    = temp != null ? (clampedTemp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN) : 0;
  const valueAngle  = START_ANGLE + fraction * ARC_SWEEP;

  const trackPath = describeArc(cx, cy, RADIUS, START_ANGLE, START_ANGLE + ARC_SWEEP);
  const fillPath  = temp != null
    ? describeArc(cx, cy, RADIUS, START_ANGLE, Math.min(valueAngle, START_ANGLE + ARC_SWEEP - 0.1))
    : null;

  const badgeClass =
    temp == null     ? 'badge-offline'  :
    temp > 40.0      ? 'badge-stress'   :
    temp > 39.5      ? 'badge-warning'  :
    temp >= 38.0     ? 'badge-online'   : 'badge-hypo';

  return (
    <div className="glass-card p-3 flex flex-col items-center gap-2">
      <span className="card-label self-start">Suhu Tubuh</span>

      <svg width="110" height="100" viewBox="0 0 110 100" className="overflow-visible">
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} strokeLinecap="round" />
        {/* Fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: 'stroke 0.5s ease' }}
          />
        )}
        {/* Center value */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color}
              fontSize="20" fontWeight="800" style={{ transition: 'fill 0.5s ease' }}>
          {temp != null ? temp.toFixed(1) : '—'}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="10">°C</text>
        {/* Range labels */}
        <text x={18} y={92} textAnchor="middle" fill="#cbd5e1" fontSize="8">{TEMP_MIN}</text>
        <text x={92} y={92} textAnchor="middle" fill="#cbd5e1" fontSize="8">{TEMP_MAX}</text>
      </svg>

      {/* Status badge suhu */}
      <span className={`badge ${badgeClass}`}>{label}</span>

      {/* Badge MOCK — hanya muncul saat sensor DS18B20 tidak terpasang / data simulasi.
          is_mock_temp dikirim dari mock-generator.js (server) atau firmware saat fallback. */}
      {isMockTemp && (
        <span
          title="Sensor DS18B20 tidak terdeteksi — data suhu adalah simulasi"
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            gap:           '0.25rem',
            fontSize:      '0.65rem',
            fontWeight:    '700',
            letterSpacing: '0.05em',
            color:         '#92400e',
            background:    '#fef3c7',
            border:        '1px solid #fbbf24',
            borderRadius:  '9999px',
            padding:       '0.15rem 0.55rem',
          }}
        >
          {/* Warning icon */}
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          MOCK
        </span>
      )}
    </div>
  );
}
