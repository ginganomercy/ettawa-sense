'use client';

import { createContext, useContext, useEffect, useRef, useReducer } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL      = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const MAX_ACCEL_POINTS = 30;

// ── State Shape ───────────────────────────────────────────────
const initialState = {
  telemetry:     null,        // Data terakhir dari ESP32
  alerts:        [],          // Array 10 alert terbaru
  deviceStatus:  { online: false, ts: null },
  accelHistory:  [],          // Rolling buffer 30 titik untuk AccelChart
  wsConnected:   false,       // Socket.io connection
  mqttConnected: false,       // MQTT broker connection (dari backend)
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

export function SocketProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef          = useRef(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      reconnectionAttempts: Infinity,
      reconnectionDelay:    3_000,
      transports:           ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect',       ()     => dispatch({ type: 'SET_WS_CONNECTED',   payload: true }));
    socket.on('disconnect',    ()     => dispatch({ type: 'SET_WS_CONNECTED',   payload: false }));
    socket.on('telemetry',     (data) => dispatch({ type: 'SET_TELEMETRY',       payload: data }));
    socket.on('alert',         (data) => dispatch({ type: 'ADD_ALERT',           payload: data }));
    socket.on('device_status', (data) => dispatch({ type: 'SET_DEVICE_STATUS',  payload: data }));
    socket.on('mqtt_status',   (data) => dispatch({ type: 'SET_MQTT_CONNECTED', payload: data.connected }));

    return () => socket.disconnect();
  }, []);

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
