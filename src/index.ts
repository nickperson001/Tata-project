import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import app from './app';
import supabase, { pgPool } from './config/supabase';
import { state, addLog, setIO, setSupabase } from './config/state';
import { PORT } from './config/constants';
import { initWhatsApp, safeDestroyClient, setIOref, healthCheck } from './services/whatsapp';
import { sendEmergencyBroadcast } from './services/emergency';
import { resetBootStatus, restoreSessionDirFromDB } from './services/session-persistence';
import { buildSessionMiddleware } from './config/session';
import { initSchedulers } from './jobs/scheduler';

setSupabase(supabase);

// Fix Supabase schema permissions — bypass PostgREST schema denial
if (pgPool) {
  pgPool.query(`
    GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO service_role, anon, authenticated;
  `)  .then(() => addLog('info', '[DB] Schema & sequence permissions granted'))
  .catch((err: Error) => addLog('warn', `[DB] Schema grant (non-fatal): ${err.message}`));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const sessionMiddleware = buildSessionMiddleware();
io.use((socket, next) => {
  sessionMiddleware(socket.request as any, {} as any, next as any);
});

io.on('connection', (socket) => {
  socket.on('register_user', (userId: string) => {
    if (userId) socket.join(userId);
  });
  socket.emit('status', { botStatus: state.botStatus, clientReady: state.clientReady, currentQR: state.currentQR, pairingCode: state.pairingCode });
  socket.emit('bot_update', { botStatus: state.botStatus, clientReady: state.clientReady, currentQR: state.currentQR, pairingCode: state.pairingCode });
  socket.on('wa_restart', async () => {
    addLog('info', '[SOCKET] Manual restart requested');
    await safeDestroyClient();
    state.waRetryCount = 0;
    setTimeout(() => initWhatsApp(), 2000);
  });
  socket.on('session_reset', async () => {
    addLog('info', '[SOCKET] Full session reset requested');
    await safeDestroyClient();
    const fs = await import('fs');
    const sessionDir = path.join(__dirname, '..', '.wwebjs_auth');
    if (fs.existsSync(sessionDir)) {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch { /* empty */ }
    }
    await supabase.from('wa_session_backup').delete().eq('user_id', 'default');
    state.waRetryCount = 0;
    setTimeout(() => initWhatsApp(), 2000);
  });
});

setIOref(io);

process.on('uncaughtException', async (err) => {
  addLog('error', `uncaughtException: ${err.message}`);
  console.error('[FATAL] uncaughtException:', err.stack);
  await sendEmergencyBroadcast(`Uncaught exception — ${err.message}`);
  setTimeout(() => process.exit(1), 5000);
});

process.on('unhandledRejection', async (reason) => {
  addLog('error', `unhandledRejection: ${reason || 'No reason'}`);
  await sendEmergencyBroadcast(`Unhandled rejection — ${reason}`);
  setTimeout(() => process.exit(1), 5000);
});

const shutdown = async (signal: string) => {
  console.log(`\n[SYSTEM] Menerima sinyal ${signal}. Menutup proses...`);
  await sendEmergencyBroadcast(`Server shutdown — signal: ${signal}`);
  try { if (state.waClient) await state.waClient.destroy(); } catch { /* empty */ }
  finally { process.exit(0); }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function ensureAssets(): Promise<void> {
  const fs = await import('fs');
  const gifPath = path.join(__dirname, '..', 'public', 'stock', 'motion.gif');
  if (!fs.existsSync(gifPath)) {
    addLog('info', '[ASSETS] motion.gif not found — downloading from GitHub');
    try {
      const res = await fetch('https://raw.githubusercontent.com/nickperson001/Tata-project/main/public/stock/motion.gif');
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(gifPath, buf);
        addLog('info', `[ASSETS] motion.gif downloaded (${buf.length} bytes)`);
      } else {
        addLog('warn', `[ASSETS] GitHub raw returned ${res.status} — loading tanpa GIF`);
      }
    } catch (e: any) {
      addLog('warn', `[ASSETS] Download gagal: ${e.message} — loading tanpa GIF`);
    }
  } else {
    addLog('info', '[ASSETS] motion.gif already exists');
  }
}

server.listen(PORT, async () => {
  addLog('info', `[SYSTEM] Server started on port ${PORT}`);

  ensureAssets();
  resetBootStatus();
  restoreSessionDirFromDB('default').finally(() => {
    initWhatsApp();
  });
  initSchedulers(state.waClient, addLog);
  setInterval(healthCheck, 30_000);
});
