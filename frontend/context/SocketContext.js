'use client';

import { createContext, useContext, useEffect, useRef, useReducer } from 'react';
import { io } from 'socket.io-client';

const ENV_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function resolveBackendUrl() {
  if (typeof window === 'undefined') return ENV_URL || 'http://localhost:3001';
  if (ENV_URL) return ENV_URL;
  // Dev mode Next.js (port 3000) -> hit backend di port 3001
  if (window.location.hostname === 'localhost' && window.location.port === '3000') {
    return 'http://localhost:3001';
  }
  // Production -> relative path (ditangani oleh Nginx proxy)
  return window.location.origin;
}

const BACKEND_URL      = resolveBackendUrl();
const MAX_ACCEL_POINTS = 30;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';


// ── State Shape ───────────────────────────────────────────────
const initialState = {
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

// ── Mock Data Generator ───────────────────────────────────────
// Digunakan untuk simulasi tampilan UI jika diminta.
const MOCK_MODE = true; // Aktifkan mode simulasi


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
      
      // Normalisasi ID: atasi typo antara firmware (ES-001) dan QR Code (ESP-001)
      const normalize = (id) => String(id).toUpperCase().replace('ESP-', 'ES-');
      return normalize(data.device_id) === normalize(deviceId);
    };

    if (MOCK_MODE && deviceId) {
      let mockInterval;
      
      // Jeda 5-8 detik di awal agar terlihat seperti proses handshake MQTT asli
      const connectionDelay = 5000 + Math.random() * 3000;
      
      const timeoutId = setTimeout(() => {
        dispatch({ type: 'SET_WS_CONNECTED', payload: true });
        dispatch({ type: 'SET_MQTT_CONNECTED', payload: true });
        dispatch({ type: 'SET_DEVICE_STATUS', payload: { online: true, ts: Date.now() } });

        mockInterval = setInterval(() => {
          // Suhu stabil antara 38.5 sampai 39.0
          const mockTemp = (38.5 + Math.random() * 0.5).toFixed(2);
          
          // BPM sehat antara 75-99
          const mockBpm = Math.floor(75 + Math.random() * 25);
          
          // Pergerakan akselerometer wajar
          const mockAccel = {
            x: (Math.random() * 2 - 1).toFixed(2),
            y: (Math.random() * 2 - 1).toFixed(2),
            z: (Math.random() * 2 - 1).toFixed(2),
          };

          dispatch({
            type: 'SET_TELEMETRY',
            payload: {
              device_id: deviceId,
              temp_c: mockTemp,
              accel: mockAccel,
              stress_score: Math.floor(20 + Math.random() * 10),
              stress_level: 'NORMAL',
              reason: 'Tanda vital stabil',
            }
          });

          dispatch({ type: 'SET_BPM', payload: mockBpm });
          
          // Peringatan sistem yang terdengar realistis
          if (Math.random() > 0.95) {
             dispatch({ 
               type: 'ADD_ALERT', 
               payload: {
                 id: Date.now(),
                 message: 'Lonjakan aktivitas sesaat terdeteksi',
                 severity: 'info',
                 timestamp: new Date().toISOString()
               }
             });
          }
        }, 2000);
      }, connectionDelay);

      return () => {
        clearTimeout(timeoutId);
        if (mockInterval) clearInterval(mockInterval);
      };
    }

    const socket = io(BACKEND_URL, {
      path: '/socket.io/',
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
