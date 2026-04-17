'use client';

import { createContext, useContext, useEffect, useRef, useReducer } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL      = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const MAX_ACCEL_POINTS = 30;

// API key untuk autentikasi ke backend.
// Di monolith (Sprint 3): frontend dan backend satu URL — masih gunakan API key untuk REST.
// Nilai dari environment variable agar tidak hardcoded di source.
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

/**
 * Resolve backend URL dinamis.
 * Di monolith: frontend dan backend satu port/URL yang sama.
 * Jika NEXT_PUBLIC_BACKEND_URL sudah dikonfigurasi ke production domain, pakai itu.
 * Di development: default ke origin halaman (same-origin) agar bisa konek dari HP via LAN.
 */
function resolveBackendUrl() {
  if (typeof window === 'undefined') return BACKEND_URL;
  // Jika env dikonfigurasi ke domain production, pakai langsung
  if (BACKEND_URL && !BACKEND_URL.includes('localhost')) return BACKEND_URL;
  // Development: same-origin (monolith pakai port yang sama dengan Next.js)
  return window.location.origin;
}


// Dikontrol via environment variable agar tidak ada nilai hardcoded di source code.
// Development: set NEXT_PUBLIC_MOCK_MODE=true di .env untuk demo UI tanpa hardware.
// Production:  WAJIB false — set di cPanel Environment Variables.
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

// ── State Shape ───────────────────────────────────────────────
const initialState = MOCK_MODE ? {
  telemetry:     { temp_c: 38.8, temp_f: 101.8, temp_status: "NORMAL", stress_score: 5, stress_level: "NORMAL", accel: {x: 0, y: 9.8, z: 0.1} },
  bpm:           115,        // Detak jantung normal (rentang 100 - 130)
  alerts:        [],          
  deviceStatus:  { online: true, ts: Date.now() },
  accelHistory:  Array.from({length: 30}, (_, i) => ({ ts: Date.now() - (30-i)*1000, x: 0, y: 9.8, z: 0.1 })),
  wsConnected:   true,       
  mqttConnected: true,       
} : {
  telemetry:     null,        
  bpm:           null,        
  alerts:        [],          
  deviceStatus:  { online: false, ts: null },
  accelHistory:  [],          
  wsConnected:   false,       
  mqttConnected: false,       
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TELEMETRY': {
      const entry = {
        ts: Date.now(),
        x:  parseFloat(action.payload.accel?.x  || 0),
        y:  parseFloat(action.payload.accel?.y  || 0),
        z:  parseFloat(action.payload.accel?.z  || 0),
      };
      return {
        ...state,
        telemetry:    action.payload,
        accelHistory: [...state.accelHistory, entry].slice(-MAX_ACCEL_POINTS),
      };
    }
    case 'SET_BPM':
      return { ...state, bpm: action.payload };
    case 'ADD_ALERT':
      return { ...state, alerts: [action.payload, ...state.alerts].slice(0, 10) };
    case 'SET_DEVICE_STATUS':
      return { ...state, deviceStatus: action.payload };
    case 'SET_WS_CONNECTED':
      return { ...state, wsConnected: action.payload };
    case 'SET_MQTT_CONNECTED':
      return { ...state, mqttConnected: action.payload };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────
const SocketContext = createContext(null);

export function SocketProvider({ children, deviceId }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef          = useRef(null);

  useEffect(() => {
    // Filter helper — ditentukan di dalam effect agar tidak stale closure
    // deviceId dari prop di-capture fresh setiap kali effect re-run
    const isTargetDevice = (data) => {
      if (!deviceId) return false;           // Belum scan QR — blokir semua data
      if (!data?.device_id) return true;     // Data tanpa label → fallback allow
      return data.device_id === deviceId;    // Filter ketat per unit kalung
    };

    if (MOCK_MODE) {
      // Mockup interval injection for UI demo
      const startTime = Date.now();
      const interval = setInterval(() => {
        const t = (Date.now() - startTime) / 1000; // waktu dalam detik

        // 1. Suhu bergerak mulus membentuk gelombang sinus santai (38.5 ~ 39.5 °C)
        // Offset 39.0, Amplitudo 0.5, Periode lambat
        const currentTemp = 39.0 + Math.sin(t * 0.1) * 0.5;
        
        // 2. BPM berayun halus antara 75 - 95 (ritme istirahat/berjalan pelan)
        // Offset 85, Amplitudo 10
        const currentBpm = Math.floor(85 + Math.sin(t * 0.4) * 10);

        // 3. Skor stres naik turun dengan sangat damai (2 - 12)
        const currentScore = Math.floor(7 + Math.sin(t * 0.2) * 5);
        const level = currentScore > 30 ? "WARNING" : "NORMAL";

        // 4. Accelerometer (3-Sumbu)
        // Mensimulasikan ayunan nafas kambing (breathing) dikombinasikan mikrovibrasi jantung (SCG/heartbeat)
        const breathing = Math.sin(t * 1.5) * 0.2; 
        const heartbeat = Math.sin(t * (currentBpm / 60) * 2 * Math.PI) * 0.5; 
        
        const accelX = breathing * 0.5;                       // Ayunan kiri kanan halus
        const accelY = 9.81 + breathing + (heartbeat * 0.2);  // Pengaruh gravitasi + nafas + dada
        const accelZ = heartbeat;                             // Dominan terpengaruh gerakan katup jantung maju mundur
        const accelMag = Math.sqrt(accelX*accelX + accelY*accelY + accelZ*accelZ);

        dispatch({
          type: 'SET_TELEMETRY',
          payload: { 
            temp_c: currentTemp,
            stress_score: currentScore,
            stress_level: level,
            reason: "NORMAL",
            accel_magnitude: accelMag,
            accel: { x: accelX, y: accelY, z: accelZ } 
          }
        });
        
        // 5. Perbarui BPM secara instan agar UI tidak terasa beku
        dispatch({ type: 'SET_BPM', payload: currentBpm });
        
      }, 1000);
      return () => clearInterval(interval);
    }

    const socket = io(resolveBackendUrl(), {
      reconnectionAttempts: Infinity,
      reconnectionDelay:    3_000,
      transports:           ['websocket'],
      // Sertakan API key di handshake — divalidasi oleh Socket.io middleware di server
      auth:         { apiKey: API_KEY },
      extraHeaders: { 'x-api-key': API_KEY },
    });
    socketRef.current = socket;

    socket.on('connect',       ()     => dispatch({ type: 'SET_WS_CONNECTED',   payload: true }));
    socket.on('disconnect',    ()     => dispatch({ type: 'SET_WS_CONNECTED',   payload: false }));
    socket.on('telemetry',     (data) => {
      if (isTargetDevice(data)) dispatch({ type: 'SET_TELEMETRY',      payload: data });
    });
    socket.on('bpm_update',    (data) => {
      if (isTargetDevice(data)) dispatch({ type: 'SET_BPM',            payload: data.bpm });
    });
    socket.on('alert',         (data) => {
      if (isTargetDevice(data)) dispatch({ type: 'ADD_ALERT',           payload: data });
    });
    socket.on('device_status', (data) => {
      if (!deviceId || data?.device_id === deviceId)
        dispatch({ type: 'SET_DEVICE_STATUS', payload: data });
    });
    socket.on('mqtt_status',   (data) => dispatch({ type: 'SET_MQTT_CONNECTED', payload: data.connected }));

    return () => socket.disconnect();
  // Re-run effect saat deviceId berubah (pengguna scan QR lain)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <SocketContext.Provider value={state}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket harus digunakan di dalam <SocketProvider>');
  return ctx;
}
