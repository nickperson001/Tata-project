import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import supabase, { pgPool } from '../config/supabase';
import { state, addLog, getIO } from '../config/state';
import { DAY_MS } from '../config/constants';
import { cacheGet, cacheSet, cacheInvalidate } from '../config/cache';
import { circuitIsOpen, circuitRecordSuccess, circuitRecordFailure } from '../services/circuit-breaker';
import { sanitizeError } from '../middleware/auth';
import qrcode from 'qrcode';
import * as stockManager from '../utils/stockManager';
import accountingEngine from '../utils/accountingEngine';
import * as transactionRecorder from '../utils/transactionRecorder';
import { generateExcel } from '../utils/excelExport';
import { setupDemoAccount } from '../utils/demoSetup';
import { withTransaction } from '../utils/db';

const router = express.Router();

interface StockRequest extends Request {
  stockUser?: any;
  stockUserId?: string;
}

function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session && (req.session as any).authenticated) return next();
  if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/api/'))
    { res.status(401).json({ error: 'Unauthorized' }); return; }
  res.redirect('/login');
}

async function stockAuth(req: StockRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.stockUser) { next(); return; }
  const token = req.query.token || (Array.isArray(req.headers['x-stock-token']) ? req.headers['x-stock-token'][0] : req.headers['x-stock-token']);
  if (!token) { res.status(401).json({ error: 'Token wajib' }); return; }
  if (circuitIsOpen()) { res.status(503).json({ error: 'Database sedang sibuk. Coba lagi sebentar.' }); return; }

  try {
    const { data: user, error } = await supabase.from('users')
      .select('id, store_name, status, dashboard_token')
      .eq('dashboard_token', token).maybeSingle() as any;
    if (error) {
      const errMsg = sanitizeError(error);
      if (errMsg.includes('[SUPABASE ERROR]')) circuitRecordFailure();
      res.status(401).json({ error: 'Token tidak valid' }); return;
    }
    if (!user) { res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa' }); return; }
    circuitRecordSuccess();
    req.stockUser = user; req.stockUserId = user.id;
    if (pgPool) {
      pgPool.query('SELECT set_config($1, $2, true)', ['app.user_id', user.id]).catch(() => {});
    }
    next();
  } catch (e: any) {
    const errMsg = sanitizeError(e);
    if (errMsg.includes('[SUPABASE ERROR]')) circuitRecordFailure();
    res.status(401).json({ error: 'Auth gagal' });
  }
}

// Middleware: blokir akses laporan & fitur PRO untuk user demo
const RESTRICTED_REPORT_PATHS = [
  '/api/stock/laba-rugi', '/api/stock/neraca', '/api/stock/general-ledger',
  '/api/stock/trial-balance', '/api/stock/cashflow', '/api/stock/report',
  '/api/stock/channels', '/api/stock/jurnal',
  '/api/stock/coa', '/api/stock/pembukuan', '/api/stock/piutang', '/api/stock/hutang',
];

async function checkDemoAccess(req: StockRequest, res: Response, next: NextFunction) {
  if (req.stockUser?.status === 'demo') {
    const blocked = RESTRICTED_REPORT_PATHS.some(p => req.path.startsWith(p));
    if (blocked) {
      res.status(403).json({ error: 'Fitur terbatas untuk demo. Upgrade ke PRO untuk akses penuh!', code: 'UPGRADE_REQUIRED' });
      return;
    }
  }
  next();
}

// Apply demo access check to restricted stock routes
router.use('/api/stock/laba-rugi', stockAuth, checkDemoAccess);
router.use('/api/stock/neraca', stockAuth, checkDemoAccess);
router.use('/api/stock/general-ledger', stockAuth, checkDemoAccess);
router.use('/api/stock/trial-balance', stockAuth, checkDemoAccess);
router.use('/api/stock/cashflow', stockAuth, checkDemoAccess);
router.use('/api/stock/report', stockAuth, checkDemoAccess);
router.use('/api/stock/channels', stockAuth, checkDemoAccess);
router.use('/api/stock/jurnal', stockAuth, checkDemoAccess);
router.use('/api/stock/coa', stockAuth, checkDemoAccess);
router.use('/api/stock/pembukuan', stockAuth, checkDemoAccess);
router.use('/api/stock/piutang', stockAuth, checkDemoAccess);
router.use('/api/stock/hutang', stockAuth, checkDemoAccess);

const MAX_STR_LEN = 255;

function requireBody(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter(f => {
      const val = (req.body as any)[f];
      return val === undefined || val === null || (typeof val === 'string' && !val.trim());
    });
    if (missing.length) { res.status(400).json({ success: false, error: `Parameter wajib: ${missing.join(', ')}` }); return; }
    next();
  };
}

function sanitizeString(val: any, maxLen = MAX_STR_LEN): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function apiSuccess(res: Response, data: any, code = 200): void {
  res.status(code).json({ success: true, ...data });
}

function apiError(res: Response, error: string, code = 400): void {
  res.status(code).json({ success: false, error });
}

router.get('/api/admin/users', isAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const search = ((req.query.search as string) || '').trim();
    const status = (req.query.status as string) || 'all';

    let query: any = supabase.from('users').select('*', { count: 'exact' });
    if (status !== 'all') query = query.eq('status', status);
    if (search) {
      const safeSearch = search.replace(/[%_(),.]/g, '');
      query = query.or(`store_name.ilike.%${safeSearch}%,id.ilike.%${safeSearch}%`);
    }
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.json({ users: data || [], meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/admin/user/:id/status', isAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['demo', 'pro', 'unlimited'].includes(status)) { res.status(400).json({ error: 'Status tidak valid' }); return; }
  try {
    const updates: any = { status, upgrade_notified: false, is_upgrading: false, upgrade_package: null,
      subscription_expires_at: status === 'pro' ? new Date(Date.now() + 30 * DAY_MS).toISOString() : null };
    const { error } = await supabase.from('users').update(updates).eq('id', id) as any;
    if (error) throw error;
    if (state.clientReady && state.waClient) {
      const notifs: Record<string, string> = { demo: 'ℹ️ Status akun Anda diubah ke DEMO (5 transaksi/hari).',
        pro: '🎉 Selamat! Akun PRO aktif 30 hari. ⭐',
        unlimited: '💎 Selamat! Akun UNLIMITED aktif seumur hidup!' };
      state.waClient.sendMessage(id, notifs[status]).catch((e: any) => addLog('warn', `WA notif gagal: ${e.message}`));
    }
    addLog('info', `User ${id} → ${status}`);
    const io = getIO();
    if (io) io.emit('user_updated', { id, status });
    res.json({ success: true, status });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/admin/maintenance', isAdmin, async (req: Request, res: Response) => {
  const { enabled } = req.body;
  try {
    await supabase.from('settings').upsert({ key: 'maintenance_mode', value: String(Boolean(enabled)) }) as any;
    state.maintenanceMode = Boolean(enabled);
    addLog('info', `Maintenance: ${state.maintenanceMode ? 'ON' : 'OFF'}`);
    res.json({ success: true, maintenance: state.maintenanceMode });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/api/admin/broadcast', isAdmin, async (req: Request, res: Response) => {
  const { message, target } = req.body;
  if (!message?.trim()) { res.status(400).json({ error: 'Message diperlukan' }); return; }
  if (!state.clientReady || !state.waClient) { res.status(503).json({ error: 'Bot belum online' }); return; }
  try {
    let query: any = supabase.from('users').select('id, store_name');
    if (target && target !== 'all') query = query.eq('status', target);
    const { data: users, error } = await query;
    if (error) throw error;
    const jobId = Date.now().toString();
    const job: any = { id: jobId, total: users.length, sent: 0, failed: 0, status: 'running', target: target || 'all' };
    (state.activeBroadcasts as Map<string, any>).set(jobId, job);
    processBroadcast(jobId, users, message);
    addLog('info', `Broadcast dimulai → ${users.length} user`);
    res.json({ success: true, jobId, total: users.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

async function processBroadcast(jobId: string, users: any[], message: string): Promise<void> {
  const ab = state.activeBroadcasts as Map<string, any>;
  const job = ab.get(jobId);
  const io = getIO();
  let firstError: string | null = null;
  for (let i = 0; i < users.length; i++) {
    try {
      const text = message.replace(/\{nama\}/gi, users[i].store_name).replace(/\{nama_toko\}/gi, users[i].store_name);
      if (state.waClient) await state.waClient.sendMessage(users[i].id, text);
      job.sent++;
    } catch (err: any) {
      job.failed++;
      if (!firstError) firstError = err.message || String(err);
    }
    if (i % 5 === 0 || i === users.length - 1) {
      job.progress = Math.round(((i + 1) / users.length) * 100);
      if (io) io.emit('broadcast_progress', { jobId, current: i + 1, total: users.length, sent: job.sent, failed: job.failed });
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  job.status = 'completed'; job.completedAt = new Date().toISOString();
  if (io) io.emit('broadcast_complete', { jobId, ...job });
  addLog('info', `Broadcast selesai: ${job.sent} terkirim, ${job.failed} gagal${firstError ? ` (error: ${firstError})` : ''}`);
}

router.post('/api/admin/pairing-code', isAdmin, async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) { res.status(400).json({ error: 'Nomor telepon wajib diisi.' }); return; }
  if (!state.waClient) { res.status(503).json({ error: 'Sistem WhatsApp belum siap.' }); return; }
  if (state.clientReady) { res.status(400).json({ error: 'Bot sudah online.' }); return; }
  try {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const code = await state.waClient.requestPairingCode(cleanNumber);
    state.pairingCode = code;
    (state as any).botStatus = 'Menunggu Tautan Pairing';
    addLog('info', `Pairing code digenerate: ${code} untuk ${cleanNumber}`);
    const io = getIO();
    if (io) io.emit('bot_update', { botStatus: state.botStatus, currentQR: state.currentQR, pairingCode: state.pairingCode, clientReady: false });
    res.json({ success: true, code });
  } catch (err: any) {
    addLog('error', `Gagal pairing code: ${err.message}`);
    res.status(500).json({ error: 'Gagal meminta kode pairing. Coba gunakan QR atau restart bot.' });
  }
});

router.get('/api/admin/status', isAdmin, (req: Request, res: Response) => {
  res.json({ botStatus: state.botStatus, clientReady: state.clientReady, currentQR: state.currentQR, pairingCode: state.pairingCode, maintenance: state.maintenanceMode });
});

router.get('/api/admin/qr-image', isAdmin, async (req: Request, res: Response) => {
  const raw = state.currentQR;
  if (!raw) { res.status(404).json({ error: 'Tidak ada QR code tersedia.' }); return; }
  try {
    const pairingCode = await qrcode.toDataURL(raw);
    state.pairingCode = pairingCode;
    res.json({ pairingCode });
  } catch (err: any) {
    addLog('error', '[API] Gagal generate QR image: ' + (err?.message || err));
    res.status(500).json({ error: 'Gagal generate QR image.' });
  }
});

router.post('/api/admin/seed-demo', isAdmin, async (_req: Request, res: Response) => {
  try {
    const { seedDemo, DEMO_SLUG, DEMO_TOKEN, DEMO_STORE } = require('../scripts/seed-demo');
    await seedDemo();
    addLog('info', '[SEED] Demo data seeded via admin panel');
    res.json({
      success: true,
      log: [
        `URL: /stock/${DEMO_SLUG}?token=${DEMO_TOKEN}`,
        `Token: ${DEMO_TOKEN}`,
        `Store: ${DEMO_STORE}`,
      ],
    });
  } catch (err: any) {
    addLog('error', `[SEED] Gagal: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api/admin/test-bot', isAdmin, async (req: Request, res: Response) => {
  const targetNumber = req.body.targetNumber || process.env.STOCK_UID || '58360586100825@lid';
  const scenario = req.body.scenario || 'all';
  const testScenarios = [
    { name: 'A. Salam & Sapaan', messages: [{ input: 'halo', expectedReply: 'Menu bantuan / panduan' }, { input: 'pagi', expectedReply: 'Menu bantuan / panduan' }, { input: 'test', expectedReply: 'Menu bantuan / panduan' }] },
    { name: 'B. Status & Info Akun', messages: [{ input: 'status', expectedReply: 'Info akun + status langganan' }, { input: 'info', expectedReply: 'Info akun + status langganan' }, { input: 'saldo', expectedReply: 'Info akun + status langganan' }] },
    { name: 'C. Laporan', messages: [{ input: 'laporan', expectedReply: 'Laporan harian (transaksi masuk/keluar)' }, { input: 'rekap', expectedReply: 'Laporan harian' }] },
    { name: 'D. Bantuan & Menu', messages: [{ input: 'bantuan', expectedReply: 'Panduan lengkap bot' }, { input: 'help', expectedReply: 'Panduan lengkap bot' }, { input: '?', expectedReply: 'Panduan lengkap bot' }, { input: '1', expectedReply: 'Menu catat transaksi' }, { input: '2', expectedReply: 'Laporan hari ini' }, { input: '3', expectedReply: 'Status akun' }, { input: '4', expectedReply: 'Bantuan & panduan' }] },
    { name: 'E. Transaksi Masuk (Interaktif)', messages: [{ input: 'masuk 15rb', expectedReply: '🤔 Produk mana? (product selection)' }, { input: 'jual nasi goreng 25rb', expectedReply: '📋 Konfirmasi Transaksi (Ya/Batal)' }, { input: 'laku roti 10000', expectedReply: '📋 Konfirmasi atau 🤔 Produk mana?' }, { input: 'dapat bonus 5jt tunai', expectedReply: '📋 Konfirmasi Transaksi' }, { input: 'terima transfer 200rb', expectedReply: '📋 Konfirmasi Transaksi' }] },
    { name: 'F. Transaksi Keluar (Interaktif)', messages: [{ input: 'keluar 50rb', expectedReply: '🤔 Produk mana? (product selection)' }, { input: 'beli stok kopi 500rb', expectedReply: '📋 Konfirmasi Transaksi (Ya/Batal)' }, { input: 'bayar sewa tempat 2jt', expectedReply: '📋 Konfirmasi atau 🤔 Produk mana?' }, { input: 'gaji karyawan 3jt', expectedReply: '📋 Konfirmasi Transaksi' }, { input: 'bensin pertamax 50rb', expectedReply: '📋 Konfirmasi Transaksi' }] },
    { name: 'G. Typo & Double Command', messages: [{ input: 'beli stock', expectedReply: 'Transaksi keluar (beli menang, bukan dashboard stock)' }, { input: 'jual laporan', expectedReply: 'Transaksi masuk (jual menang, bukan laporan)' }, { input: 'masuk keluar 15rb', expectedReply: 'Tipe ambigu → tanya user (Masuk/Keluar)' }] },
    { name: 'H. Kasir / Sale Regex', messages: [{ input: 'jual kopi 2', expectedReply: 'Kasir flow — cek stok & eksekusi' }, { input: 'laku nasi goreng 3', expectedReply: 'Kasir flow' }, { input: 'jual es teh manis 5', expectedReply: 'Kasir flow' }] },
    { name: 'I. Tagihan (Auto-Invoice)', messages: [{ input: 'tagih 150rb ke 08123456789', expectedReply: 'Invoice terkirim + PDF' }, { input: 'tagih', expectedReply: 'Panduan format tagihan' }] },
    { name: 'J. Bank Profile', messages: [{ input: 'setbank BCA 8670662536 Hanan', expectedReply: 'Bank profile tersimpan' }, { input: 'setbank', expectedReply: 'Panduan format setbank' }] },
    { name: 'K. Upgrade & Paket', messages: [{ input: 'paket', expectedReply: 'Menu upgrade PRO/UNLIMITED' }, { input: 'upgrade', expectedReply: 'Menu upgrade' }] },
    { name: 'L. Dashboard & Stock', messages: [{ input: 'dashboard', expectedReply: 'Link dashboard + token' }, { input: 'link stok', expectedReply: 'Link dashboard + token' }, { input: 'token baru', expectedReply: 'Token baru + link baru' }] },
    { name: 'M. Catch-All (Pesan Tidak Dikenal)', messages: [{ input: 'asdfghjkl', expectedReply: 'Maaf belum paham + panduan singkat' }, { input: 'cuaca hari ini', expectedReply: 'Maaf belum paham + panduan singkat' }] },
    { name: 'N. Konfirmasi & Batal', messages: [{ input: 'ya', expectedReply: 'Jika ada konfirmasi pending → catat transaksi' }, { input: 'batal', expectedReply: 'Batalkan proses yang sedang berjalan' }, { input: 'cancel', expectedReply: 'Batalkan proses' }] },
  ];
  let selectedScenarios = testScenarios;
  if (scenario !== 'all') {
    const found = testScenarios.find(s => s.name.toLowerCase().includes(scenario.toLowerCase()));
    if (found) selectedScenarios = [found];
    else { res.status(400).json({ error: `Scenario "${scenario}" not found. Available: ${testScenarios.map(s => s.name).join(', ')}` }); return; }
  }
  let testMsg = `🧪 *TEST BOT — ${selectedScenarios.length} Skenario*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const s of selectedScenarios) {
    testMsg += `*${s.name}*\n`;
    for (const m of s.messages) testMsg += `  📝 "${m.input}" → ${m.expectedReply}\n`;
    testMsg += '\n';
  }
  testMsg += `━━━━━━━━━━━━━━━━━━━━━━━\nTotal: ${selectedScenarios.reduce((sum: number, s: any) => sum + s.messages.length, 0)} test cases\nKirim pesan di atas ke bot untuk testing langsung.`;
  let waSent = false;
  if (state.clientReady && state.waClient) {
    try { await state.waClient.sendMessage(targetNumber, testMsg); waSent = true; } catch (e: any) { addLog('error', `[TEST-BOT] Failed to send WA: ${e.message}`); }
  }
  res.json({ success: true, waSent, targetNumber, scenarios: selectedScenarios.length, totalTests: selectedScenarios.reduce((sum: number, s: any) => sum + s.messages.length, 0), testPlan: selectedScenarios, message: testMsg });
});

router.get('/api/stock/verify', stockAuth, (req: StockRequest, res: Response) => {
  res.json({ id: req.stockUser.id, store_name: req.stockUser.store_name, status: req.stockUser.status });
});

// ── WA Login: user logs in with their WA number to get their dashboard token ──
router.post('/api/stock/auth/wa', async (req: Request, res: Response) => {
  const rawWa: string = (req.body.whatsapp || '').toString().trim().replace(/[\s\-]/g, '');
  if (!rawWa) { res.status(400).json({ error: 'Nomor WhatsApp wajib diisi' }); return; }

  // Normalize: convert 08x → 628x and append @c.us / @s.whatsapp.net search variants
  let normalized = rawWa;
  if (normalized.startsWith('0')) normalized = '62' + normalized.slice(1);
  if (!normalized.startsWith('62')) normalized = '62' + normalized;

  const candidateIds = [
    `${normalized}@c.us`,
    `${normalized}@s.whatsapp.net`,
    normalized,
    rawWa,
  ];

  try {
    // Search user by any of the candidate IDs
    const { data: user, error } = await supabase
      .from('users')
      .select('id, store_name, status, dashboard_token')
      .in('id', candidateIds)
      .maybeSingle() as any;

    if (error) { res.status(500).json({ error: 'Terjadi kesalahan server' }); return; }

    if (!user) {
      res.status(404).json({
        error: 'Nomor WhatsApp tidak terdaftar. Kirim pesan "Daftar" ke bot WhatsApp Tata untuk mendaftar terlebih dahulu.',
        code: 'NOT_REGISTERED',
      });
      return;
    }

    if (!user.dashboard_token) {
      res.status(403).json({
        error: 'Akun Anda belum memiliki token dashboard. Kirim pesan "Dashboard" ke bot WhatsApp Tata.',
        code: 'NO_TOKEN',
      });
      return;
    }

    res.json({
      token: user.dashboard_token,
      user: { id: user.id, store_name: user.store_name, status: user.status },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// ── User Settings (active_channels, preferences) ──
router.get('/api/stock/settings', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const [{ data: userData, error: userErr }, { data: chData, error: chErr }] = await Promise.all([
      supabase.from('users').select('metadata').eq('id', userId).maybeSingle() as any,
      supabase.from('sales_channels').select('name, coa_code, admin_fee_pct').eq('user_id', userId).eq('is_active', true) as any,
    ]);
    if (userErr) throw userErr;
    const settings = (userData?.metadata as any) || {};
    const channels = (chData || []).map((r: any) => ({
      name: r.name,
      coa_code: r.coa_code,
      admin_fee_pct: Number(r.admin_fee_pct) || 0,
    }));
    res.json({ settings, channels });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/settings', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const updates = req.body;
  if (!updates || typeof updates !== 'object') { res.status(400).json({ error: 'Body tidak valid' }); return; }
  try {
    // Merge metadata
    const { data: existing } = await supabase.from('users').select('metadata').eq('id', userId).maybeSingle() as any;
    const currentMeta = (existing?.metadata as any) || {};
    const { channel_fees, ...metaUpdates } = updates;
    const newMeta = { ...currentMeta, ...metaUpdates };
    const { error: metaErr } = await supabase.from('users').update({ metadata: newMeta }).eq('id', userId) as any;
    if (metaErr) throw metaErr;

    // Update channel fees in sales_channels
    if (Array.isArray(channel_fees)) {
      for (const cf of channel_fees) {
        if (!cf.name) continue;
        const feePct = Math.min(100, Math.max(0, Number(cf.admin_fee_pct) || 0));
        const { data: existing } = await supabase
          .from('sales_channels')
          .select('id')
          .eq('user_id', userId)
          .eq('name', cf.name)
          .maybeSingle() as any;
        if (existing) {
          await supabase.from('sales_channels').update({ admin_fee_pct: feePct }).eq('id', existing.id) as any;
        }
      }
    }

    res.json({ success: true, settings: newMeta });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/batch', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const batchCacheKey = `batch:${userId}`;
  const cached = cacheGet(batchCacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const [prodResult, movResult, alertResult] = await Promise.all([
      supabase.from('products').select('id, sku, name, category, unit, stock_current, stock_min, price_buy, price_sell, supplier, location, notes').eq('user_id', userId).eq('is_active', true).order('name', { ascending: true }),
      supabase.from('stock_movements').select('*, products(id, sku, name, unit)').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('stock_alerts').select('*, products(id, sku, name, unit, stock_current, stock_min)').eq('user_id', userId).is('resolved_at', null).order('alerted_at', { ascending: false }).limit(10),
    ]);
    const products = (prodResult as any).data || [];
    const movements = (movResult as any).data || [];
    const alerts = (alertResult as any).data || [];
    let totalValue = 0, lowStock = 0, outStock = 0; const byCategory: Record<string, any> = {};
    products.forEach((p: any) => {
      const stock = parseFloat(p.stock_current) || 0; const min = parseFloat(p.stock_min) || 0;
      const val = stock * (parseFloat(p.price_buy) || 0);
      totalValue += val;
      if (stock <= 0) outStock++; else if (stock <= min) lowStock++;
      const cat = p.category || 'Umum';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, value: 0 };
      byCategory[cat].count++; byCategory[cat].value += val;
    });
    const result = { products, summary: { total: products.length, active: products.length, totalValue, lowStock, outStock, byCategory, alerts }, recentMovements: movements };
    cacheSet(batchCacheKey, result, 45_000);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/summary', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const cacheKey = `summary:${userId}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const { data: products } = await supabase.from('products').select('id, category, stock_current, stock_min, price_buy, unit').eq('user_id', userId).eq('is_active', true) as any;
    let totalValue = 0, lowStock = 0, outStock = 0; const byCategory: Record<string, any> = {};
    (products || []).forEach((p: any) => {
      const stock = parseFloat(p.stock_current) || 0; const min = parseFloat(p.stock_min) || 0;
      const val = stock * (parseFloat(p.price_buy) || 0);
      totalValue += val;
      if (stock <= 0) outStock++; else if (stock <= min) lowStock++;
      const cat = p.category || 'Umum';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, value: 0 };
      byCategory[cat].count++; byCategory[cat].value += val;
    });
    const { data: alertData } = await supabase.from('stock_alerts').select('*, products(id, sku, name, unit, stock_current, stock_min)').eq('user_id', userId).is('resolved_at', null).order('alerted_at', { ascending: false }).limit(10) as any;
    const result = { total: (products || []).length, active: (products || []).length, totalValue, lowStock, outStock, byCategory, alerts: alertData || [] };
    cacheSet(cacheKey, result, 60_000);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/products', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const category = (req.query.category as string) || '';
  const status = (req.query.status as string) || '';
  try {
    let query: any = supabase.from('products').select('id, sku, name, category, unit, stock_current, stock_min, price_buy, price_sell, default_channel, supplier, location, notes, is_active', { count: 'exact' }).eq('user_id', userId).eq('is_active', true);
    if (search) {
      const safeSearch = search.replace(/[%_(),.]/g, '');
      query = query.or(`name.ilike.%${safeSearch}%,sku.ilike.%${safeSearch}%`);
    }
    if (category) query = query.eq('category', category);
    if (status === 'out') query = query.lte('stock_current', 0);
    else if (status === 'low') query = query.gt('stock_current', 0).filter('stock_current', 'lte', 'stock_min');
    else if (status === 'ok') query = query.filter('stock_current', 'gt', 'stock_min');
    const sort = (req.query.sort as string) || 'name';
    if (sort === 'stock_asc') query = query.order('stock_current', { ascending: true });
    else if (sort === 'stock_desc') query = query.order('stock_current', { ascending: false });
    else if (sort === 'value_desc') query = query.order('stock_current', { ascending: false });
    else query = query.order('name', { ascending: true });
    if (page > 0) query = query.range((page - 1) * limit, page * limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    if (sort === 'value_desc' && data && page === 0) data.sort((a: any, b: any) => (b.price_buy * b.stock_current) - (a.price_buy * a.stock_current));
    res.json({ products: data || [], total: count || 0, page, limit });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/products', stockAuth, requireBody('name'), async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;

  // Demo: maksimal 3 produk
  if (req.stockUser?.status === 'demo') {
    const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId) as any;
    if (count >= 3) {
      res.status(403).json({ error: 'Demo terbatas 3 produk. Upgrade ke PRO untuk produk tak terbatas!', code: 'UPGRADE_REQUIRED' });
      return;
    }
  }

  const name = sanitizeString(req.body.name, 150);
  const sku = sanitizeString(req.body.sku, 50);
  const category = sanitizeString(req.body.category, 50);
  const unit = sanitizeString(req.body.unit, 20);
  const supplier = sanitizeString(req.body.supplier, 100);
  const location = sanitizeString(req.body.location, 100);
  const notes = sanitizeString(req.body.notes, 500);
  const defaultChannel = sanitizeString(req.body.default_channel, 30);
  const priceBuy = req.body.price_buy ?? req.body.priceBuy;
  const priceSell = req.body.price_sell ?? req.body.priceSell;
  const stockInitial = req.body.stock_initial ?? req.body.stockInitial;
  const stockMin = req.body.stock_min ?? req.body.stockMin;
  try {
    const result = await stockManager.addProduct(userId, { sku, name, category, unit, priceBuy: parseFloat(priceBuy) || 0, priceSell: parseFloat(priceSell) || 0, stockInitial: parseFloat(stockInitial) || 0, stockMin: parseFloat(stockMin) || 0, description: notes });
    if (!result.success) { apiError(res, result.error!); return; }
    const newProduct = result.product as any;
    if (supplier || location || defaultChannel) await supabase.from('products').update({ supplier, location, default_channel: defaultChannel || null }).eq('id', newProduct.id).eq('user_id', userId) as any;
    // Jurnal stok awal
    const initStock = parseFloat(stockInitial) || 0;
    const initPrice = parseFloat(priceBuy) || parseFloat(newProduct.price_buy) || 0;
    if (initStock > 0 && initPrice > 0) {
      (async () => {
        try {
          const { data: initMov } = await supabase.from('stock_movements').select('id').eq('user_id', userId).eq('product_id', newProduct.id).eq('reference_type', 'initial').order('created_at', { ascending: false }).limit(1).single() as any;
          if (initMov) {
            await withTransaction(async (client) => {
              await accountingEngine.insertJournalViaClient(client, userId, {
                referenceType: 'stock_initial',
                referenceId: String(initMov.id),
                description: `Stok Awal ${initStock} ${newProduct.unit}: ${newProduct.name}`,
                lines: [
                  { accountCode: '1201', debit: initStock * initPrice, credit: 0, description: 'Penambahan inventori' },
                  { accountCode: '3101', debit: 0, credit: initStock * initPrice, description: 'Modal inventori' },
                ],
              });
            });
          }
        } catch (jErr: any) {
          addLog('error', '[PRODUCT] Gagal bikin jurnal stok awal: ' + jErr.message);
        }
      })();
    }
    cacheInvalidate(userId);
    apiSuccess(res, { product: result.product });
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.put('/api/stock/products/:productId', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const { productId } = req.params;
  const name = sanitizeString(req.body.name, 150);
  const category = sanitizeString(req.body.category, 50);
  const unit = sanitizeString(req.body.unit, 20);
  const supplier = sanitizeString(req.body.supplier, 100);
  const location = sanitizeString(req.body.location, 100);
  const notes = sanitizeString(req.body.notes, 500);
  const defaultChannel = sanitizeString(req.body.default_channel, 30);
  const { price_buy, price_sell, stock_min } = req.body;
  try {
    const { error } = await supabase.from('products').update({ name, category, unit, price_buy: parseFloat(price_buy) || 0, price_sell: parseFloat(price_sell) || 0, stock_min: parseFloat(stock_min) || 0, supplier, location, notes, default_channel: defaultChannel || null }).eq('id', productId).eq('user_id', userId) as any;
    if (error) throw error;
    cacheInvalidate(userId);
    apiSuccess(res, {});
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.delete('/api/stock/products/:productId', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const result = await stockManager.deleteProduct(userId, String(req.params.productId));
    if (!result.success) { res.status(400).json({ error: result.error }); return; }
    cacheInvalidate(userId);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/categories', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const { data, error } = await supabase.from('product_categories').select('*').eq('user_id', userId).eq('is_active', true).order('name') as any;
    if (error) throw error;
    res.json({ categories: data || [] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/categories', stockAuth, requireBody('name'), async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const name = sanitizeString(req.body.name, 50);
  if (!name) { apiError(res, 'Nama kategori wajib'); return; }
  try {
    const { data, error } = await supabase.from('product_categories').insert({ user_id: userId, name }).select().single() as any;
    if (error) { apiError(res, error.message); return; }
    res.json({ category: data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/api/stock/categories/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const name = sanitizeString(req.body.name, 50);
  if (!name) { apiError(res, 'Nama kategori wajib'); return; }
  try {
    const { error } = await supabase.from('product_categories').update({ name }).eq('id', req.params.id).eq('user_id', userId) as any;
    if (error) { apiError(res, error.message); return; }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/stock/categories/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const { error } = await supabase.from('product_categories').update({ is_active: false }).eq('id', req.params.id).eq('user_id', userId) as any;
    if (error) { apiError(res, error.message); return; }
    // Reset category produk yang menggunakan kategori ini ke kosong
    await supabase.from('products').update({ category: '' }).eq('user_id', userId).eq('category', req.body.categoryName || '') as any;
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/movement', stockAuth, requireBody('product_id', 'type', 'quantity'), async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const product_id = String(req.body.product_id);
  const type = req.body.type;
  const quantity = parseFloat(String(req.body.quantity));
  const note = sanitizeString(req.body.note, 500);
  const unit_price = req.body.unit_price;
  const channel = req.body.channel ? String(req.body.channel) : '';
  if (isNaN(quantity) || quantity <= 0) { apiError(res, 'Jumlah harus lebih dari 0'); return; }
  if (!['in', 'out'].includes(type)) { apiError(res, 'Tipe harus in atau out'); return; }
  try {
    // Resolve channel for COA revenue account & admin fee
    let revenueCoa = '4101';
    let adminFeePct = 0;
    if (channel) {
      const { data: chData } = await supabase
        .from('sales_channels')
        .select('coa_code, admin_fee_pct')
        .eq('user_id', userId)
        .eq('name', channel)
        .maybeSingle() as any;
      if (chData) {
        revenueCoa = chData.coa_code || '4101';
        adminFeePct = Number(chData.admin_fee_pct) || 0;
      }
    }

    const result = await withTransaction(async (client) => {
      const prod = await client.query(
        `SELECT id, name, stock_current, stock_min, unit, price_buy, price_sell FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [product_id, userId]
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const p = prod.rows[0];
      const stockBefore = parseFloat(p.stock_current) || 0;
      const stockAfter = type === 'in' ? stockBefore + quantity : stockBefore - quantity;
      if (stockAfter < 0) {
        throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore} ${p.unit}`);
      }
      await client.query(
        `UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`,
        [stockAfter, product_id, userId]
      );
      const mov = await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_via)
         VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, 'dashboard')
         RETURNING id`,
        [userId, product_id, type, quantity, stockBefore, stockAfter, note || null]
      );
      const movId = mov.rows[0].id;
      if (type === 'in') {
        const buyPrice = unit_price ? parseFloat(String(unit_price)) : (parseFloat(p.price_buy) || 0);
        const totalValue = quantity * buyPrice;
        if (unit_price || parseFloat(p.price_buy) > 0) {
          await client.query(
            `UPDATE stock_movements SET unit_price = $1, total_value = $2 WHERE id = $3`,
            [buyPrice, totalValue, movId]
          );
        }
        if (totalValue > 0) {
          await accountingEngine.insertJournalViaClient(client, userId, {
            referenceType: 'stock_in',
            referenceId: String(movId),
            description: `Stok Masuk ${quantity} ${p.unit}: ${p.name}`,
            lines: [
              { accountCode: '1201', debit: totalValue, credit: 0, description: 'Penambahan inventori' },
              { accountCode: '3101', debit: 0, credit: totalValue, description: 'Modal inventori' },
            ],
          });
        }
      } else {
        const sellPrice = parseFloat(p.price_sell) || 0;
        const buyPrice = parseFloat(p.price_buy) || 0;
        const omzet = quantity * sellPrice;
        const modal = quantity * buyPrice;
        const bebanAdmin = omzet * (adminFeePct / 100);
        const danaBersih = omzet - bebanAdmin;

        if (sellPrice > 0) {
          await client.query(
            `UPDATE stock_movements SET unit_price = $1, total_value = $2 WHERE id = $3`,
            [sellPrice, omzet, movId]
          );
        }
        // Always create journal for stock-out (revenue) if sellPrice > 0
        if (omzet > 0) {
          const lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }> = [];
          if (bebanAdmin > 0) {
            lines.push(
              { accountCode: '1101', debit: danaBersih, credit: 0, description: 'Penerimaan penjualan (bersih)' },
              { accountCode: '6105', debit: bebanAdmin, credit: 0, description: `Beban admin ${channel} ${adminFeePct}%` },
              { accountCode: revenueCoa, debit: 0, credit: omzet, description: `Penjualan via ${channel || 'Offline'}` },
            );
          } else {
            lines.push(
              { accountCode: '1101', debit: omzet, credit: 0, description: 'Penerimaan penjualan' },
              { accountCode: revenueCoa, debit: 0, credit: omzet, description: `Penjualan via ${channel || 'Offline'}` },
            );
          }
          if (modal > 0) {
            lines.push(
              { accountCode: '5101', debit: modal, credit: 0, description: `HPP ${quantity} item` },
              { accountCode: '1201', debit: 0, credit: modal, description: 'Pengurangan inventori' },
            );
          }
          await accountingEngine.insertJournalViaClient(client, userId, {
            referenceType: 'stock_out',
            referenceId: String(movId),
            description: `Penjualan ${quantity} ${p.unit}: ${p.name}${channel ? ' (' + channel + ')' : ''}`,
            lines,
          });

          const profit = omzet - modal - bebanAdmin;
          await client.query(
            `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, reference_type, product_id, quantity, price_sell, price_buy, profit, hpp)
             VALUES ($1, 'masuk', 'tunai', $2, $3, $4, 'stock_out', $5, $6, $7, $8, $9, $10)`,
            [userId, channel || 'Offline', omzet, `Penjualan ${quantity} ${p.unit}: ${p.name} [mov:${movId}]`, product_id, quantity, sellPrice, buyPrice, profit, modal]
          );
        }
      }
      return { stockBefore, stockAfter, product: { id: p.id, stock_min: p.stock_min, unit: p.unit } };
    });
    const rp = result.product as any;
    if (result.stockAfter <= rp.stock_min && result.stockAfter > 0) {
      supabase.from('stock_alerts').insert([{ user_id: userId, product_id, alert_type: 'low_stock', stock_level: result.stockAfter }] as any).then(() => {
        const io = getIO(); if (io) io.to(userId).emit('stock_alert', { userId, product_id, alertType: 'low_stock', stockLevel: result.stockAfter });
      }).then(null, () => {});
    } else if (result.stockAfter <= 0) {
      supabase.from('stock_alerts').insert([{ user_id: userId, product_id, alert_type: 'out_of_stock', stock_level: result.stockAfter }] as any).then(() => {
        const io = getIO(); if (io) io.to(userId).emit('stock_alert', { userId, product_id, alertType: 'out_of_stock', stockLevel: result.stockAfter });
      }).then(null, () => {});
    }
    if ((type === 'in') && result.stockAfter > rp.stock_min) {
      supabase.from('stock_alerts').update({ resolved_at: new Date().toISOString() }).eq('product_id', product_id).eq('user_id', userId).is('resolved_at', null).then(() => {}).then(null, () => {});
    }
    cacheInvalidate(userId);
    res.json({ success: true, stockBefore: result.stockBefore, stockAfter: result.stockAfter });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/stock/movement/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const { data: mov } = await supabase.from('stock_movements').select('*').eq('id', req.params.id).eq('user_id', userId).single() as any;
    if (!mov) { apiError(res, 'Tidak ditemukan', 404); return; }
    const reverseType = mov.type === 'in' ? 'out' : 'in';
    await withTransaction(async (client) => {
      const prod = await client.query(
        `SELECT id, name, stock_current, stock_min, unit FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [mov.product_id, userId]
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const p = prod.rows[0];
      const stockBefore = parseFloat(p.stock_current) || 0;
      const stockAfter = reverseType === 'in' ? stockBefore + mov.quantity : stockBefore - mov.quantity;
      if (stockAfter < 0) throw new Error('Stok tidak cukup setelah reversal');
      await client.query(
        `UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`,
        [stockAfter, mov.product_id, userId]
      );
      await client.query(`DELETE FROM stock_movements WHERE id = $1 AND user_id = $2`, [mov.id, userId]);

      // Reverse original journal entries by querying them
      const refType = mov.type === 'in' ? 'stock_in' : 'stock_out';
      const je = await client.query(
        `SELECT id FROM journal_entries WHERE reference_type = $1 AND reference_id = $2 AND user_id = $3`,
        [refType, String(mov.id), userId]
      );
      if (je.rows.length > 0) {
        const jl = await client.query(
          `SELECT account_code, debit, credit, description FROM journal_lines WHERE entry_id = $1`,
          [je.rows[0].id]
        );
        const reversalLines = jl.rows.map((l: any) => ({
          accountCode: l.account_code,
          debit: parseFloat(l.credit) || 0,
          credit: parseFloat(l.debit) || 0,
          description: `Reverse ${l.description || ''}`,
        }));
        await accountingEngine.insertJournalViaClient(client, userId, {
          referenceType: 'stock_reversal',
          referenceId: String(mov.id),
          description: `Reverse ${mov.type === 'in' ? 'Stok Masuk' : 'Penjualan'} ${mov.quantity} ${p.unit}: ${p.name}`,
          lines: reversalLines,
        });
      }

      // Delete linked transaction record (stock_out only)
      if (mov.type === 'out') {
        await client.query(
          `DELETE FROM transactions WHERE user_id = $1 AND reference_type = 'stock_out' AND description LIKE $2`,
          [userId, `%[mov:${mov.id}]%`]
        );
      }

      // Resolve any stock alerts for this product
      await client.query(
        `UPDATE stock_alerts SET resolved_at = NOW() WHERE product_id = $1 AND user_id = $2 AND resolved_at IS NULL`,
        [mov.product_id, userId]
      );
    });
    cacheInvalidate(userId);
    apiSuccess(res, {});
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.get('/api/stock/movements', stockAuth, async (req: StockRequest, res: Response) => {
  const limit = Math.min(100, parseInt(req.query.limit as string) || 30); const page = Math.max(1, parseInt(req.query.page as string) || 1);
  try {
    let query: any = supabase.from('stock_movements').select('*, products(id, sku, name, unit)', { count: 'exact' }).eq('user_id', req.stockUser!.id).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (req.query.product_id) query = query.eq('product_id', req.query.product_id);
    if (req.query.type) query = query.eq('type', req.query.type);
    const { data, error, count } = await query;
    if (error) throw error; res.json({ movements: data || [], total: count || 0, page, limit });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/report', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(365, parseInt(req.query.days as string) || 30);
  const limit = Math.min(1000, Math.max(10, parseInt(req.query.limit as string) || 500));
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  try {
    const [movQuery, totalsQuery] = await Promise.all([
      supabase.from('stock_movements').select('*, products(id, name, sku, unit)', { count: 'exact' }).eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1),
      supabase.from('stock_movements').select('type, quantity, product_id, products(id, name, sku, unit, price_buy, price_sell)').eq('user_id', userId).gte('created_at', since),
    ]);
    const movs = (movQuery as any).data || []; const totalCount = (movQuery as any).count || 0; const allMovs = (totalsQuery as any).data || [];
    let totalIn = 0, totalOut = 0, totalAdj = 0; const outByProduct: Record<string, any> = {};
    allMovs.forEach((m: any) => {
      const qty = parseFloat(m.quantity) || 0;
      const unitPrice = m.products ? (m.type === 'in' ? (parseFloat(m.products.price_buy) || 0) : (parseFloat(m.products.price_sell) || 0)) : 0;
      const val = qty * unitPrice;
      if (m.type === 'in') totalIn += val; else if (m.type === 'out') totalOut += val; else if (m.type === 'adjustment') totalAdj++;
      if (m.type === 'out' && m.products) {
        const key = m.product_id;
        if (!outByProduct[key]) outByProduct[key] = { ...m.products, total: 0 };
        outByProduct[key].total += parseFloat(m.quantity);
      }
    });
    const maxOut = Math.max(...Object.values(outByProduct).map((p: any) => p.total), 1);
    const topOut = Object.values(outByProduct).sort((a: any, b: any) => b.total - a.total).slice(0, 8).map((p: any) => ({ ...p, pct: Math.round((p.total / maxOut) * 100) }));
    const catCacheKey = `report-cat:${userId}`;
    let byCategory: Record<string, any> = cacheGet(catCacheKey) as any;
    if (!byCategory) {
      const { data: products } = await supabase.from('products').select('category, stock_current, price_buy').eq('user_id', userId).eq('is_active', true) as any;
      byCategory = {};
      (products || []).forEach((p: any) => {
        const cat = p.category || 'Umum'; const val = parseFloat(p.stock_current) * parseFloat(p.price_buy);
        if (!byCategory[cat]) byCategory[cat] = { count: 0, value: 0 };
        byCategory[cat].count++; byCategory[cat].value += val;
      });
      cacheSet(catCacheKey, byCategory, 120_000);
    }
    res.json({ totalIn, totalOut, totalAdj, count: totalCount, topOut, byCategory, page, limit, total: totalCount });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/cashflow', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(90, parseInt(req.query.days as string) || 30);
  const cacheKey = `cashflow:${userId}:${days}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const { data: jeRows } = await supabase
      .from('journal_entries').select('id, entry_date').eq('user_id', userId).gte('entry_date', since) as any;
    let cashInflow: Record<string, number> = {};
    let cashOutflow: Record<string, number> = {};
    if (jeRows?.length) {
      const { data: jlRows } = await supabase
        .from('journal_lines').select('entry_id, account_code, debit, credit')
        .in('entry_id', jeRows.map((e: any) => e.id))
        .eq('account_code', '1101') as any;
      const dateMap: Record<string, string> = {};
      jeRows.forEach((e: any) => { dateMap[e.id] = e.entry_date?.slice(0, 10); });
      (jlRows || []).forEach((l: any) => {
        const key = dateMap[l.entry_id];
        if (!key) return;
        if (Number(l.debit) > 0) cashInflow[key] = (cashInflow[key] || 0) + Number(l.debit);
        if (Number(l.credit) > 0) cashOutflow[key] = (cashOutflow[key] || 0) + Number(l.credit);
      });
    }
    const dailyMap: Record<string, any> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, masuk: 0, keluar: 0 };
    }
    Object.keys(cashInflow).forEach(key => { if (dailyMap[key]) dailyMap[key].masuk = cashInflow[key]; });
    Object.keys(cashOutflow).forEach(key => { if (dailyMap[key]) dailyMap[key].keluar = cashOutflow[key]; });
    const result = Object.values(dailyMap);
    cacheSet(cacheKey, result, 120_000);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/overview', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const period = (req.query.period as string) || 'month';
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam = req.query.endDate as string | undefined;
  const cacheKey = startDateParam && endDateParam
    ? `overview:${userId}:custom:${startDateParam}:${endDateParam}`
    : `overview:${userId}:${period}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }
  const periods: Record<string, number> = { day: 1, week: 7, month: 30, all: 365 };
  const days = periods[period] || 30;
  try {
    const since = startDateParam && endDateParam
      ? new Date(startDateParam).toISOString()
      : new Date(Date.now() - days * DAY_MS).toISOString();
    const until = startDateParam && endDateParam
      ? new Date(endDateParam + 'T23:59:59.999Z').toISOString()
      : new Date().toISOString();
    const [transResult, stockResult] = await Promise.all([
      supabase.from('transactions').select('type, amount, reference_type').eq('user_id', userId).gte('created_at', since).lte('created_at', until),
      supabase.from('products').select('stock_current, stock_min, price_buy').eq('user_id', userId).eq('is_active', true),
    ]);
    const trans = (transResult as any).data || [];
    const products = (stockResult as any).data || [];
    let omzet = 0, pengeluaran = 0, piutang = 0;
    trans.forEach((t: any) => {
      const v = Number(t.amount) || 0;
      if (t.type === 'masuk' && t.reference_type !== 'modal' && t.reference_type !== 'receivable') omzet += v;
      else if (t.type === 'keluar') pengeluaran += v;
      if (t.reference_type === 'receivable') piutang += (t.type === 'masuk' ? v : -v);
    });
    let totalNilaiStok = 0;
    let stokHabis = 0, stokMenipis = 0;
    products.forEach((p: any) => {
      const stk = parseFloat(p.stock_current) || 0;
      const min = parseFloat(p.stock_min) || 0;
      totalNilaiStok += stk * (parseFloat(p.price_buy) || 0);
      if (stk <= 0) stokHabis++;
      else if (min > 0 && stk <= min) stokMenipis++;
    });
    const { data: cashierSales } = await supabase.from('transactions').select('price_buy, quantity').eq('user_id', userId).in('reference_type', ['cashier', 'stock_out']).gte('created_at', since).lte('created_at', until) as any;
    let hpp = 0; (cashierSales || []).forEach((t: any) => { hpp += (Number(t.quantity) || 0) * (Number(t.price_buy) || 0); });
    const labaBersih = omzet - hpp - pengeluaran;
    const profitMargin = omzet > 0 ? (labaBersih / omzet) * 100 : 0;
    const result = {
      total_omzet: omzet,
      total_hpp: hpp,
      total_pengeluaran: pengeluaran,
      laba_bersih: labaBersih,
      profit_margin: profitMargin,
      nilai_inventori: totalNilaiStok,
      piutang: Math.max(0, piutang),
      total_product: products.length,
      stok_habis: stokHabis,
      stok_menipis: stokMenipis,
      period: days,
    };
    cacheSet(cacheKey, result, 120_000);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/product-stats', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const { data: products } = await supabase.from('products').select('id, sku, name, category, unit, stock_current, stock_min, price_buy, price_sell').eq('user_id', userId).eq('is_active', true) as any;
    if (!products) { res.json({ products: [] }); return; }
    const result = products.map((p: any) => {
      const buy = parseFloat(p.price_buy) || 0, sell = parseFloat(p.price_sell) || 0, stock = parseFloat(p.stock_current) || 0;
      const profitPerUnit = sell - buy;
      const margin = sell > 0 ? Math.round((profitPerUnit / sell) * 100) : 0;
      const stockValue = stock * buy;
      return { ...p, profitPerUnit, margin, stockValue };
    }).sort((a: any, b: any) => b.stockValue - a.stockValue);
    res.json({ products: result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/laba-rugi', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const days = Math.min(365, parseInt(req.query.days as string) || 30);
    const channel = req.query.channel as string || '';
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - days * DAY_MS).toISOString();
    if (channel) {
      const since = startDate;
      const { data: trans } = await supabase.from('transactions').select('type, reference_type, amount, price_buy, quantity').eq('user_id', userId).eq('channel', channel).gte('created_at', since) as any;
      let revenue = 0, expense = 0, hpp = 0;
      (trans || []).forEach((t: any) => {
        const v = Number(t.amount) || 0;
        if (t.type === 'masuk' && t.reference_type !== 'modal') revenue += v;
        else if (t.type === 'keluar') expense += v;
        if (t.reference_type === 'cashier') {
          hpp += (Number(t.quantity) || 0) * (Number(t.price_buy) || 0);
        }
      });
      const labaBersih = revenue - hpp - expense;
      res.json({
        rows: [
          { account_code: 'TRX', account_name: `Transaksi ${channel}`, account_type: 'revenue', total: revenue },
          { account_code: 'HPP', account_name: 'Harga Pokok Penjualan', account_type: 'cogs', total: hpp },
          { account_code: 'BIAYA', account_name: 'Biaya Operasional', account_type: 'expense', total: expense },
        ],
        totalRevenue: revenue, totalCOGS: hpp, totalExpense: expense,
        labaKotor: revenue - hpp, labaBersih,
      });
      return;
    }
    const result = await accountingEngine.getLabaRugi(userId, startDate, endDate);
    if (!result.success) { res.status(500).json(result); return; }
    res.json(result.data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/channels', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(90, parseInt(req.query.days as string) || 30);
  const cacheKey = `channels:${userId}:${days}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const { data: trans } = await supabase.from('transactions').select('amount, channel').eq('user_id', userId).eq('type', 'masuk').gte('created_at', since) as any;
    const channels: Record<string, number> = {};
    (trans || []).forEach((t: any) => {
      const v = Number(t.amount) || 0;
      const ch = t.channel || 'Offline';
      channels[ch] = (channels[ch] || 0) + v;
    });
    cacheSet(cacheKey, channels, 120_000);
    res.json(channels);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Channel Profitability Analysis ──

router.get('/api/stock/channel-profitability', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(365, parseInt(req.query.days as string) || 30);
  try {
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const { data: trans } = await supabase.from('transactions').select('channel, type, reference_type, amount, price_buy, quantity').eq('user_id', userId).gte('created_at', since) as any;

    const channelMap: Record<string, { revenue: number; hpp: number }> = {};
    (trans || []).forEach((t: any) => {
      const ch = t.channel || 'Offline';
      if (!channelMap[ch]) channelMap[ch] = { revenue: 0, hpp: 0 };
      const v = Number(t.amount) || 0;
      if (t.type === 'masuk' && t.reference_type !== 'modal' && t.reference_type !== 'receivable') {
        channelMap[ch].revenue += v;
      }
      if (t.reference_type === 'cashier') {
        const qty = Number(t.quantity) || 0;
        const buy = Number(t.price_buy) || 0;
        channelMap[ch].hpp += qty * buy;
      }
    });

    const result = Object.entries(channelMap).map(([channel, data]) => {
      const netProfit = data.revenue - data.hpp;
      const margin = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;
      return { channel, revenue: data.revenue, hpp: data.hpp, netProfit, margin: Math.round(margin * 10) / 10 };
    }).sort((a, b) => b.revenue - a.revenue);

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/piutang', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const statusFilter = (req.query.status as string) || 'all';
  try {
    const { data: debtsData } = await supabase
      .from('debts').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const list: any[] = ((debtsData as any[]) || []).map((d: any) => ({
      nama: d.nama_pelanggan,
      status: d.status_lunas ? 'paid' : 'unpaid',
      tanggal: d.created_at || d.jatuh_tempo,
      jumlah: Math.abs(Number(d.nominal_piutang) || 0),
    }));

    let filtered = list;
    if (statusFilter === 'paid') filtered = list.filter(i => i.status === 'paid');
    else if (statusFilter === 'unpaid') filtered = list.filter(i => i.status === 'unpaid');
    filtered.sort((a, b) => b.jumlah - a.jumlah);

    const belumLunas = filtered.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.jumlah, 0);
    const sudahLunas = filtered.filter(i => i.status === 'paid').reduce((s, i) => s + i.jumlah, 0);

    res.json({
      totalPiutang: belumLunas,
      belumLunas,
      sudahLunas,
      jumlahTagihan: filtered.length,
      list: filtered,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/api/stock/transactions/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const { id } = req.params;
  const { type, amount, description } = req.body;
  try {
    if (description != null) {
      const desc = sanitizeString(description, 500);
      const { error } = await supabase.from('transactions').update({ description: desc }).eq('id', id).eq('user_id', userId) as any;
      if (error) throw error;
      cacheInvalidate(userId);
      apiSuccess(res, {});
    } else {
      apiError(res, 'Hanya deskripsi yang bisa diubah. Untuk mengubah nominal/tipe, hapus dan buat ulang.', 400);
    }
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.delete('/api/stock/transactions/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const { id } = req.params;
  try {
    const { data: tx, error: txErr } = await supabase.from('transactions').select('*').eq('id', id).eq('user_id', userId).single() as any;
    if (txErr || !tx) { apiError(res, 'Transaksi tidak ditemukan', 404); return; }

    await withTransaction(async (client) => {
      // Reverse stock effect if applicable (with FOR UPDATE lock)
      if (tx.product_id && tx.quantity && Number(tx.quantity) > 0) {
        const prod = await client.query(
          `SELECT id, name, stock_current FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [tx.product_id, userId]
        );
        if (prod.rows.length > 0) {
          const newStock = parseFloat(prod.rows[0].stock_current) + Number(tx.quantity);
          await client.query(
            `UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`,
            [newStock, tx.product_id, userId]
          );
        }
      }

      // Reverse journal entries linked to this transaction
      const refTypes = ['sale', 'expense', 'manual', 'pembukuan', 'modal', 'receivable', 'stock_out', 'damaged_goods'];
      for (const refType of refTypes) {
        const je = await client.query(
          `SELECT id FROM journal_entries WHERE reference_type = $1 AND reference_id = $2 AND user_id = $3`,
          [refType, String(id), userId]
        );
        if (je.rows.length > 0) {
          const jl = await client.query(
            `SELECT account_code, debit, credit, description FROM journal_lines WHERE entry_id = $1`,
            [je.rows[0].id]
          );
          const reversalLines = jl.rows.map((l: any) => ({
            accountCode: l.account_code,
            debit: parseFloat(l.credit) || 0,
            credit: parseFloat(l.debit) || 0,
            description: `Reverse ${l.description || ''}`,
          }));
          await accountingEngine.insertJournalViaClient(client, userId, {
            referenceType: 'tx_reversal',
            referenceId: String(id),
            description: `Reverse transaksi: ${tx.description || ''}`,
            lines: reversalLines,
          });
          break;
        }
      }

      // Delete the transaction
      await client.query(`DELETE FROM transactions WHERE id = $1 AND user_id = $2`, [id, userId]);

      // Resolve stock alerts
      if (tx.product_id) {
        await client.query(
          `UPDATE stock_alerts SET resolved_at = NOW() WHERE product_id = $1 AND user_id = $2 AND resolved_at IS NULL`,
          [tx.product_id, userId]
        );
      }
    });
    cacheInvalidate(userId);
    apiSuccess(res, {});
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.get('/api/stock/saldo', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    if (!pgPool) { res.status(500).json({ error: 'Database tidak tersedia' }); return; }
    const [coaResult, jlResult] = await Promise.all([
      supabase.from('chart_of_accounts').select('balance').eq('user_id', userId).eq('code', '1101').single(),
      pgPool.query(
        `SELECT
          COALESCE(SUM(jl.debit), 0) as total_masuk,
          COALESCE(SUM(jl.credit), 0) as total_keluar
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE jl.account_code = '1101' AND je.user_id = $1`,
        [userId]
      ),
    ]);
    const saldo = (coaResult as any).data ? Number((coaResult as any).data.balance) : 0;
    const { total_masuk, total_keluar } = jlResult.rows[0];
    res.json({ saldo, totalMasuk: Number(total_masuk), totalKeluar: Number(total_keluar) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/pembukuan', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 30);
  const startDate = (req.query.start_date as string) || undefined;
  const endDate = (req.query.end_date as string) || undefined;
  try {
    let query: any = supabase.from('transactions').select('*, products(name, sku, unit)', { count: 'exact' }).eq('user_id', userId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');
    query = query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    const { data: trans, error, count } = await query as any;
    if (error) throw error;
    let totalMasuk = 0, totalKeluar = 0;
    (trans || []).forEach((t: any) => { if (t.type === 'masuk') totalMasuk += Number(t.amount) || 0; else totalKeluar += Number(t.amount) || 0; });
    const { data: products } = await supabase.from('products').select('id, name').eq('user_id', userId).eq('is_active', true).order('name') as any;
    let journal: any[] = [];
    try {
      const { data: je } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(50) as any;
      if (je?.length) {
        const { data: jl } = await supabase
          .from('journal_lines')
          .select('*')
          .in('entry_id', je.map((e: any) => e.id)) as any;
        journal = jl || [];
      }
    } catch { journal = []; }
    res.json({ transaksi: trans || [], total: count || 0, page, limit, totalMasuk, totalKeluar, products: products || [], journalEntries: journal || [] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/pembukuan', stockAuth, requireBody('type', 'amount', 'description'), async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const type = sanitizeString(req.body.type, 20);
  const description = sanitizeString(req.body.description, 500);
  const amount = parseFloat(req.body.amount);
  const customerName = sanitizeString(req.body.customerName, 100);
  const coaDebit = sanitizeString(req.body.coaDebit, 10) || undefined;
  const coaCredit = sanitizeString(req.body.coaCredit, 10) || undefined;
  const channel = sanitizeString(req.body.channel, 50) || undefined;
  try {
    const result = await transactionRecorder.recordPembukuan({
      userId, tipe: type, amount, description,
      customerName: customerName || undefined,
      coaDebit, coaCredit, channel,
    });
    if (!result.success) { apiError(res, result.error!); return; }
    cacheInvalidate(userId);
    apiSuccess(res, {});
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.get('/api/stock/hutang', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(365, parseInt(req.query.days as string) || 90);
  const statusFilter = (req.query.status as string) || 'all';
  try {
    let query: any = supabase.from('accounts_payable').select('*')
      .eq('user_id', userId)
      .order('jatuh_tempo', { ascending: true })
      .limit(200);
    if (days < 365) {
      const since = new Date(Date.now() - days * DAY_MS).toISOString();
      query = query.gte('created_at', since);
    }
    const { data: list, error } = await query;
    if (error) throw error;

    let filtered = list || [];
    if (statusFilter === 'unpaid') filtered = filtered.filter((i: any) => !i.status_lunas);
    else if (statusFilter === 'paid') filtered = filtered.filter((i: any) => i.status_lunas);
    else if (statusFilter === 'overdue') {
      const now = new Date().toISOString();
      filtered = filtered.filter((i: any) => !i.status_lunas && i.jatuh_tempo && i.jatuh_tempo < now);
    }

    const totalHutang = filtered.reduce((s: number, i: any) => s + Number(i.nominal_hutang) - Number(i.jumlah_dibayar || 0), 0);
    const belumLunas = filtered.filter((i: any) => !i.status_lunas).reduce((s: number, i: any) => s + Number(i.nominal_hutang) - Number(i.jumlah_dibayar || 0), 0);
    const sudahLunas = filtered.filter((i: any) => i.status_lunas).reduce((s: number, i: any) => s + Number(i.nominal_hutang), 0);

    res.json({ totalHutang: Math.max(0, totalHutang), belumLunas: Math.max(0, belumLunas), sudahLunas, jumlahTagihan: filtered.length, list: filtered });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/hutang', stockAuth, requireBody('nama_supplier', 'nominal_hutang'), async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const nama_supplier = sanitizeString(req.body.nama_supplier, 150);
  const nominal_hutang = parseFloat(req.body.nominal_hutang);
  const deskripsi = sanitizeString(req.body.deskripsi, 500);
  const jatuh_tempo = req.body.jatuh_tempo || null;
  try {
    const { data, error } = await supabase.from('accounts_payable').insert([{
      user_id: userId, nama_supplier, nominal_hutang, deskripsi,
      jatuh_tempo: jatuh_tempo || null,
    }]).select().single() as any;
    if (error) throw error;
    cacheInvalidate(userId);
    apiSuccess(res, { hutang: data });
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.put('/api/stock/hutang/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const { id } = req.params;
  const { nominal_hutang, jumlah_dibayar, status_lunas, jatuh_tempo, deskripsi } = req.body;
  try {
    const updates: Record<string, unknown> = {};
    if (nominal_hutang != null) updates.nominal_hutang = parseFloat(String(nominal_hutang));
    if (jumlah_dibayar != null) updates.jumlah_dibayar = parseFloat(String(jumlah_dibayar));
    if (status_lunas != null) updates.status_lunas = Boolean(status_lunas);
    if (jatuh_tempo !== undefined) updates.jatuh_tempo = jatuh_tempo || null;
    if (deskripsi !== undefined) updates.deskripsi = sanitizeString(deskripsi, 500);
    if (Object.keys(updates).length === 0) { apiError(res, 'Tidak ada perubahan'); return; }
    const { error } = await supabase.from('accounts_payable').update(updates).eq('id', id).eq('user_id', userId) as any;
    if (error) throw error;
    cacheInvalidate(userId);
    apiSuccess(res, {});
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.delete('/api/stock/hutang/:id', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const { error } = await supabase.from('accounts_payable').delete().eq('id', req.params.id).eq('user_id', userId) as any;
    if (error) throw error;
    cacheInvalidate(userId);
    apiSuccess(res, {});
  } catch (e: any) { apiError(res, e.message, 500); }
});

router.get('/api/stock/coa', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const result = await accountingEngine.getCoA(userId);
    if (!result.success) { res.status(500).json(result); return; }
    res.json({ accounts: result.data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/neraca', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const endDate = (req.query.end_date as string) || undefined;
  try {
    const result = await accountingEngine.getBalanceSheet(userId, endDate);
    if (!result.success) { res.status(500).json(result); return; }
    res.json(result.data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/jurnal', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
  try {
    const { data: entries, error, count } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1) as any;
    if (error) throw error;

    const result = (entries || []).map((e: any) => ({ ...e, lines: [] }));
    if (result.length) {
      const entryIds = result.map((e: any) => e.id);
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('*')
        .in('entry_id', entryIds) as any;
      const codeMap: Record<string, string> = {};
      const codes = [...new Set((lines || []).map((l: any) => l.account_code).filter(Boolean))];
      if (codes.length) {
        const { data: coa } = await supabase
          .from('chart_of_accounts')
          .select('code, name')
          .in('code', codes).eq('user_id', userId) as any;
        (coa || []).forEach((a: any) => { codeMap[a.code] = a.name; });
      }
      const lineMap: Record<string, any[]> = {};
      (lines || []).forEach((l: any) => {
        if (!lineMap[l.entry_id]) lineMap[l.entry_id] = [];
        lineMap[l.entry_id].push({ ...l, account_name: codeMap[l.account_code] || l.account_code });
      });
      result.forEach((e: any) => { e.lines = lineMap[e.id] || []; });
    }

    res.json({ list: result, total: count || 0, page, limit });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/general-ledger', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(365, parseInt(req.query.days as string) || 90);
  const from = new Date(Date.now() - days * DAY_MS).toISOString();
  const accountCode = (req.query.account as string) || (req.query.account_code as string);
  try {
    let account: any = null;
    if (accountCode) {
      const { data: acct } = await supabase.from('chart_of_accounts').select('*').eq('user_id', userId).eq('code', accountCode).single() as any;
      account = acct;
      if (!account) { res.json({ account: null, entries: [] }); return; }
    }

    const { data: entryRows } = await supabase
      .from('journal_entries')
      .select('id, entry_date, reference_type, description')
      .eq('user_id', userId)
      .gte('created_at', from)
      .order('created_at', { ascending: false })
      .limit(500) as any;
    if (!entryRows?.length) { res.json({ account, entries: [] }); return; }

    const entryIds = entryRows.map((e: any) => e.id);
    const entryMap: Record<string, any> = {};
    entryRows.forEach((e: any) => { entryMap[e.id] = e; });

    let query: any = supabase
      .from('journal_lines')
      .select('*')
      .in('entry_id', entryIds);
    if (accountCode) query = query.eq('account_code', accountCode);
    const { data: lines, error } = await query;
    if (error) throw error;

    const entries = (lines || []).map((l: any) => {
      const entry = entryMap[l.entry_id] || {};
      return { debit: l.debit, credit: l.credit, entry_date: entry.entry_date, reference_type: entry.reference_type, description: l.description || entry.description || '' };
    });

    res.json({ account, entries });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/trial-balance', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const result = await accountingEngine.getTrialBalance(userId);
    if (!result.success) { res.status(500).json(result); return; }
    res.json(result.data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/dashboard/charts', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = Math.min(90, parseInt(req.query.days as string) || 30);
  const channel = req.query.channel as string || '';
  try {
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    let query: any = supabase.from('transactions')
      .select('type, amount, description, created_at')
      .eq('user_id', userId).gte('created_at', since)
      .order('created_at', { ascending: true });
    if (channel) query = query.eq('channel', channel);
    const { data: trans } = await query as any;

    const dailyMap: Record<string, { revenue: number; expense: number }> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().slice(0, 10)] = { revenue: 0, expense: 0 };
    }
    (trans || []).forEach((t: any) => {
      const key = t.created_at.slice(0, 10);
      if (dailyMap[key]) {
        const v = Number(t.amount) || 0;
        if (t.type === 'masuk') dailyMap[key].revenue += v;
        else dailyMap[key].expense += v;
      }
    });
    const labels = Object.keys(dailyMap);
    const revenue = Object.values(dailyMap).map((d: any) => d.revenue);
    const expense = Object.values(dailyMap).map((d: any) => d.expense);

    const expenseMap: Record<string, number> = {};
    (trans || []).filter((t: any) => t.type === 'keluar').forEach((t: any) => {
      const d = (t.description || '').toLowerCase();
      let cat = 'Lainnya';
      if (d.includes('gaji')) cat = 'Gaji';
      else if (d.includes('sewa')) cat = 'Sewa';
      else if (d.includes('listrik') || d.includes('air')) cat = 'Listrik & Air';
      else if (d.includes('transport') || d.includes('bensin')) cat = 'Transportasi';
      else if (d.includes('produk') || d.includes('beli')) cat = 'Pembelian Stok';
      expenseMap[cat] = (expenseMap[cat] || 0) + (Number(t.amount) || 0);
    });
    const expenseLabels = Object.keys(expenseMap);
    const expenseValues = Object.values(expenseMap);

    const { data: prodTrans } = await supabase.from('transactions')
      .select('description, amount, quantity')
      .eq('user_id', userId).eq('type', 'masuk')
      .not('product_id', 'is', null).gte('created_at', since)
      .limit(1000) as any;
    const productMap: Record<string, { revenue: number; qty: number }> = {};
    (prodTrans || []).forEach((t: any) => {
      const name = (t.description || 'Unknown').split(' ').slice(0, 4).join(' ');
      productMap[name] = productMap[name] || { revenue: 0, qty: 0 };
      productMap[name].revenue += Number(t.amount) || 0;
      productMap[name].qty += Number(t.quantity) || 1;
    });
    const topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    res.json({ labels, revenue, expense, expenseLabels, expenseValues, topProducts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/stock/chat', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: 'Message diperlukan' }); return; }
  try {
    const chatbot = require('../utils/chatbot');
    const result = await chatbot.processMessage(userId, message);
    res.json({ success: true, reply: result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/alerts', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const result = await stockManager.getPendingAlerts(userId);
    if (!result.success) {
      res.status(500).json({ error: result.error || 'Gagal memuat notifikasi' });
      return;
    }
    res.json({ data: { alerts: result.alerts || [] } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Excel Export ──

router.get('/api/stock/export/laba-rugi', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = parseInt(req.query.days as string) || 30;
  const channel = req.query.channel as string || '';
  try {
    let rows: any[];
    let totalRevenue = 0, totalCOGS = 0, totalExpense = 0;
    if (channel) {
      const since = new Date(Date.now() - days * DAY_MS).toISOString();
      const { data: trans } = await supabase.from('transactions').select('type, reference_type, amount, price_buy, quantity').eq('user_id', userId).eq('channel', channel).gte('created_at', since) as any;
      let revenue = 0, expense = 0, hpp = 0;
      (trans || []).forEach((t: any) => {
        const v = Number(t.amount) || 0;
        if (t.type === 'masuk' && t.reference_type !== 'modal') revenue += v;
        else if (t.type === 'keluar') expense += v;
        if (t.reference_type === 'cashier') hpp += (Number(t.quantity) || 0) * (Number(t.price_buy) || 0);
      });
      totalRevenue = revenue; totalCOGS = hpp; totalExpense = expense;
      rows = [
        { Kode: 'TRX', Akun: `Transaksi ${channel}`, Tipe: 'Pendapatan', Jumlah: revenue },
        { Kode: 'HPP', Akun: 'Harga Pokok Penjualan', Tipe: 'HPP', Jumlah: hpp },
        { Kode: 'BIAYA', Akun: 'Biaya Operasional', Tipe: 'Beban', Jumlah: expense },
        { Kode: 'LABA', Akun: 'Laba Bersih', Tipe: '-', Jumlah: revenue - hpp - expense },
      ];
    } else {
      const result = await accountingEngine.getLabaRugi(userId, new Date(Date.now() - days * DAY_MS).toISOString(), new Date().toISOString());
      if (!result.success || !result.data) { res.status(500).json({ error: 'Gagal muat data' }); return; }
      const d = result.data;
      totalRevenue = d.totalRevenue; totalCOGS = d.totalCOGS; totalExpense = d.totalExpense;
      rows = d.rows.map((r: any) => ({
        Kode: r.account_code,
        Akun: r.account_name,
        Tipe: r.account_type === 'revenue' ? 'Pendapatan' : r.account_type === 'cogs' ? 'HPP' : 'Beban',
        Jumlah: r.total,
      }));
    }
    rows.push({ Kode: '', Akun: 'Laba Bersih', Tipe: '', Jumlah: totalRevenue - totalCOGS - totalExpense });
    const buf = await generateExcel([{ name: 'Laba Rugi', columns: [{ header: 'Kode', key: 'Kode', width: 12 }, { header: 'Akun', key: 'Akun', width: 30 }, { header: 'Tipe', key: 'Tipe', width: 15 }, { header: 'Jumlah', key: 'Jumlah', width: 18 }], rows }], `LabaRugi-${days}d.xlsx`);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="LabaRugi-${days}d.xlsx"`);
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/export/neraca', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const result = await accountingEngine.getBalanceSheet(userId);
    if (!result.success || !result.data) { res.status(500).json({ error: 'Gagal muat data' }); return; }
    const d = result.data;
    const rows: Record<string, any>[] = [];
    (d.aset?.items || []).forEach((i: any) => rows.push({ Kode: i.code, Akun: i.name, Kelompok: 'Aset', Jumlah: i.absolute }));
    (d.liabilitas?.items || []).forEach((i: any) => rows.push({ Kode: i.code, Akun: i.name, Kelompok: 'Liabilitas', Jumlah: i.absolute }));
    (d.ekuitas?.items || []).forEach((i: any) => rows.push({ Kode: i.code, Akun: i.name, Kelompok: 'Ekuitas', Jumlah: i.absolute }));
    const buf = await generateExcel([{ name: 'Neraca', columns: [{ header: 'Kode', key: 'Kode', width: 12 }, { header: 'Akun', key: 'Akun', width: 30 }, { header: 'Kelompok', key: 'Kelompok', width: 15 }, { header: 'Jumlah', key: 'Jumlah', width: 18 }], rows }], 'Neraca.xlsx');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="Neraca.xlsx"');
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/export/arus-kas', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = parseInt(req.query.days as string) || 30;
  try {
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const { data: trans } = await supabase.from('transactions').select('created_at, type, amount, channel, description').eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }) as any;
    const rows = (trans || []).map((t: any) => ({
      Tanggal: new Date(t.created_at).toLocaleDateString('id-ID'),
      Tipe: t.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      Keterangan: t.description || '',
      Channel: t.channel || '-',
      Jumlah: t.type === 'masuk' ? Number(t.amount) : -Number(t.amount),
    }));
    const buf = await generateExcel([{ name: 'Arus Kas', columns: [{ header: 'Tanggal', key: 'Tanggal', width: 14 }, { header: 'Tipe', key: 'Tipe', width: 14 }, { header: 'Keterangan', key: 'Keterangan', width: 35 }, { header: 'Channel', key: 'Channel', width: 14 }, { header: 'Jumlah', key: 'Jumlah', width: 18 }], rows }], `ArusKas-${days}d.xlsx`);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="ArusKas-${days}d.xlsx"`);
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/export/pembukuan', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  const days = parseInt(req.query.days as string) || 30;
  const channel = req.query.channel as string || '';
  const search = req.query.search as string || '';
  try {
    let query: any = supabase.from('transactions').select('created_at, type, amount, description, channel, customer_name').eq('user_id', userId).gte('created_at', new Date(Date.now() - days * DAY_MS).toISOString()).order('created_at', { ascending: false });
    if (channel) query = query.eq('channel', channel);
    if (search) {
      const safe = search.replace(/[%_]/g, '');
      query = query.or(`description.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
    }
    const { data: trans } = await query as any;
    const rows = (trans || []).map((t: any) => ({
      Tanggal: new Date(t.created_at).toLocaleDateString('id-ID'),
      Tipe: t.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      Keterangan: t.description || '',
      Channel: t.channel || '-',
      Pelanggan: t.customer_name || '-',
      Jumlah: Number(t.amount),
    }));
    const buf = await generateExcel([{ name: 'Pembukuan', columns: [{ header: 'Tanggal', key: 'Tanggal', width: 14 }, { header: 'Tipe', key: 'Tipe', width: 14 }, { header: 'Keterangan', key: 'Keterangan', width: 35 }, { header: 'Channel', key: 'Channel', width: 14 }, { header: 'Pelanggan', key: 'Pelanggan', width: 18 }, { header: 'Jumlah', key: 'Jumlah', width: 18 }], rows }], 'Pembukuan.xlsx');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="Pembukuan.xlsx"');
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/stock/export/produk', stockAuth, async (req: StockRequest, res: Response) => {
  const userId = req.stockUser!.id;
  try {
    const { data: products } = await supabase.from('products').select('sku, name, category, unit, price_buy, price_sell, stock_current, stock_min, default_channel').eq('user_id', userId).eq('is_active', true).order('name') as any;
    const rows = (products || []).map((p: any) => ({
      SKU: p.sku,
      Nama: p.name,
      Kategori: p.category || '-',
      Satuan: p.unit || '-',
      'Harga Beli': p.price_buy || 0,
      'Harga Jual': p.price_sell || 0,
      Stok: p.stock_current || 0,
      'Stok Min': p.stock_min || 0,
      Channel: p.default_channel || 'Semua',
    }));
    const buf = await generateExcel([{ name: 'Produk', columns: [{ header: 'SKU', key: 'SKU', width: 16 }, { header: 'Nama', key: 'Nama', width: 28 }, { header: 'Kategori', key: 'Kategori', width: 14 }, { header: 'Satuan', key: 'Satuan', width: 10 }, { header: 'Harga Beli', key: 'Harga Beli', width: 14 }, { header: 'Harga Jual', key: 'Harga Jual', width: 14 }, { header: 'Stok', key: 'Stok', width: 10 }, { header: 'Stok Min', key: 'Stok Min', width: 10 }, { header: 'Channel', key: 'Channel', width: 14 }], rows }], 'Produk.xlsx');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="Produk.xlsx"');
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Demo Account Setup (one-time) ──

router.post('/api/stock/demo/setup', async (req: Request, res: Response) => {
  try {
    const result = await setupDemoAccount();
    if (result.error) { res.status(500).json({ error: result.error }); return; }
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
