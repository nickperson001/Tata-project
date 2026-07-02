import { Router } from 'express';
import os from 'os';
import supabase from '../config/supabase';
import { circuitIsOpen, circuitRecordSuccess, circuitRecordFailure } from '../services/circuit-breaker';

const router = Router();

router.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

router.get('/health', async (_req, res) => {
  const used = process.memoryUsage();
  let dbStatus = 'unknown';

  if (circuitIsOpen()) {
    dbStatus = 'circuit_open (cooling down)';
  } else {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) {
        dbStatus = 'error';
        circuitRecordFailure();
      } else {
        dbStatus = 'connected';
        circuitRecordSuccess();
      }
    } catch {
      dbStatus = 'error';
      circuitRecordFailure();
    }
  }

  const { state } = require('../config/state');

  res.status(200).json({
    status: 'running',
    wa_ready: state.clientReady,
    bot: state.botStatus,
    ready: state.clientReady,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    circuit_breaker: state._circuit?.state || 'CLOSED',
    session: state.pgPool ? 'postgresql' : 'memory',
    system: {
      memory: {
        used: Math.round(used.heapUsed / 1024 / 1024),
        total: Math.round(used.heapTotal / 1024 / 1024),
        percentage: Math.round((used.heapUsed / used.heapTotal) * 100),
      },
      cpu: os.loadavg(),
      platform: os.platform(),
    },
  });
});

export default router;
