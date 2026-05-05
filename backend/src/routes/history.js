/**
 * @file routes/history.js
 * @brief REST endpoint untuk query riwayat data telemetri.
 *
 * GET /api/history?hours=24
 *   → Array data telemetri N jam terakhir
 *
 * GET /api/alerts
 *   → Array alert terbaru (max 20)
 *
 * GET /api/health
 *   → Status backend (storage mode, uptime, MQTT status)
 */

import { Router } from 'express';
import { queryHistory, getRecentAlerts, storageMode } from '../data-store.js';

const router = Router();

// ── GET /api/history ──────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 168); // max 7 hari
    const data  = await queryHistory(hours);
    res.json({ ok: true, count: data.length, hours, data });
  } catch (err) {
    console.error('[History] Query error:', err.message);
    res.status(500).json({ ok: false, error: 'Gagal query data riwayat' });
  }
});

// ── GET /api/alerts ───────────────────────────────────────────
router.get('/alerts', (_req, res) => {
  try {
    const alerts = getRecentAlerts();
    res.json({ ok: true, count: alerts.length, data: alerts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/health ───────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    ok:           true,
    service:      'ettawa-backend',
    storage_mode: storageMode,
    uptime_s:     Math.floor(process.uptime()),
    ts:           new Date().toISOString(),
  });
});

export default router;
