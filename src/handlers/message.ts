import crypto from 'crypto';
import { MessageMedia } from 'whatsapp-web.js';

import supabase from '../config/supabase';
import { sendReport } from '../jobs/scheduler';
import { transcribeAudio, extractTextFromImage } from '../utils/mediaProcessor';
import * as stockManager from '../utils/stockManager';
import * as transactionRecorder from '../utils/transactionRecorder';
import accountingEngine from '../utils/accountingEngine';
import * as geminiRouter from '../utils/geminiRouter';
import { parseCurrency, parseQuantity, formatPhone, formatRupiah, getDailyTransactionCount, getEffectiveStatus, getDaysRemaining, buildStatusMessage } from '../utils/helpers';
import { PACKAGES, PAYMENT } from '../config/packages';
import { KW_KELUAR, KW_MASUK, KW_STATUS, KW_LAPORAN, KW_BANTUAN, KW_UPGRADE, KW_BATAL, KW_STOCK, KW_PRODUCT, KW_DASHBOARD } from '../config/keywords';
import { addLog } from '../config/state';
import { circuitIsOpen, circuitRecordSuccess, circuitRecordFailure } from '../services/circuit-breaker';
import { sanitizeError, isMessageProcessed, markMessageProcessed, pendingSaleDialogs, pendingClassificationDialogs, pendingTxConfirmations, pendingProductSelections, onboardingStates, graduatedVirtualUsers, safeReply, getMaintenanceMode, invalidateMaintenanceCache, withSenderLock } from '../config/message-state';
import { generateUniqueSlug } from '../utils/slug';
import { handleStockList, handleStockInfo, handleStockReport } from './stock-handler';
import { handleInvoiceCommand, handleSetBankCommand, generateInvoiceNumber, normalizeWaNumber, getBankCache, setBankCache, generateInvoicePDF } from './invoice-handler';
import { handleOnboardingStep } from './onboarding';

async function handleSaleCommand(msg: any, sender: string, user: any, productQuery: string, quantityStr: string, unitStr: string | null, channelName = 'Offline'): Promise<boolean> {
  const qty = parseFloat(quantityStr.replace(',', '.'));
  if (isNaN(qty) || qty <= 0) {
    await safeReply(msg, `⚠️ Jumlah tidak valid: *${quantityStr}*.\nContoh yang benar: *jual kopi 2* atau *jual galon 3*`);
    return true;
  }

  const searchRes = await stockManager.searchProductByName(user.id, productQuery);
  if (!searchRes.success) {
    await safeReply(msg, `❌ Gagal mencari produk: ${searchRes.error}`);
    return true;
  }

  const matches = searchRes.products!;

  if (matches.length === 0) {
    await safeReply(msg, `⚠️ Produk "*${productQuery}*" tidak ditemukan di database Anda.\n\nKetik *Stock list* untuk melihat daftar produk yang tersedia.`);
    return true;
  }

  if (matches.length === 1) return processSaleExecution(msg, sender, user, matches[0], qty, channelName);

  pendingSaleDialogs.set(sender, { products: matches, qty, query: productQuery, channel: channelName, timestamp: Date.now() });

  let text = `🤔 *Banyak Produk Cocok*\n\nAda beberapa produk yang cocok dengan pencarian "*${productQuery}*":\n\n`;
  matches.forEach((p: any, i: number) => { text += `${i + 1}. *${p.name}* (Sisa: ${stockManager.formatQty(p.stock_current, p.unit)} ${p.unit})\n`; });
  text += `\nKetik *angka* pilihan Anda (1-${matches.length}).\nKetik *Batal* untuk membatalkan.`;

  await safeReply(msg, text);
  return true;
}

async function processSaleExecution(msg: any, sender: string, user: any, product: any, qty: number, channelName = 'Offline'): Promise<boolean> {
  const res = await stockManager.executeSale(user.id, product.id, qty);
  if (!res.success) { await safeReply(msg, `❌ *Gagal Mencatat Penjualan*\n\n${res.error}`); return true; }

  const d = res.data!;
  const channelTag = channelName !== 'Offline' ? ` (${channelName})` : '';
  const friendlyClose = [
    `Sip bos! Uang masuk ${formatRupiah(d.totalOmzet)} udah Tata catet ya. Laris manis! 🔥`,
    `Mantap bos! ${formatRupiah(d.totalOmzet)} masuk kas. Rejeki terus ya! 💰`,
    `Oke bos! ${formatRupiah(d.totalOmzet)} tercatat. Semoga makin cuan! 🚀`,
  ];
  const closingLine = friendlyClose[Math.floor(Math.random() * friendlyClose.length)];

  await safeReply(msg,
    `✅ *Sip bos! Transaksi tercatat ya!*\n\n` +
    `💰 *Uang Masuk*: ${formatRupiah(d.totalOmzet)}${channelTag}\n` +
    `📦 *${product.name}*: -${stockManager.formatQty(qty, product.unit)} ${product.unit} (sisa: ${stockManager.formatQty(d.stockAfter, product.unit)})\n\n` +
    `_${closingLine}_\n_Ketik *Batal* dalam 1 menit kalau ada yang keliru._`
  );
  return true;
}

async function showUpgradeMenu(msg: any, user: any, effectiveStatus: string): Promise<void> {
  if (effectiveStatus === 'unlimited') {
    await safeReply(msg, `💎 Bos *${user.store_name}* sudah berlangganan *UNLIMITED* selamanya!\nSemua fitur sudah aktif tanpa batas. Terima kasih! 🙏`);
    return;
  }
  let currentInfo = '';
  if (effectiveStatus === 'pro') {
    const sisa = getDaysRemaining(user);
    currentInfo = `\n📌 Status sekarang: *PRO* — sisa *${sisa} hari*\n`;
  }
  await safeReply(msg,
    `💰 *Pilih Paket - ${user.store_name}*\n${currentInfo}\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⭐ *1. PRO Bulanan — ${PACKAGES.pro.priceStr}*\n${PACKAGES.pro.features.map((f: string) => `   ✅ ${f}`).join('\n')}` +
    `\n\n💎 *2. UNLIMITED Selamanya — ${PACKAGES.unlimited.priceStr}*\n${PACKAGES.unlimited.features.map((f: string) => `   ✅ ${f}`).join('\n')}` +
    `\n━━━━━━━━━━━━━━━━━━━━━━━\nKetik *Pilih 1* untuk PRO Bulanan\nKetik *Pilih 2* untuk UNLIMITED Selamanya`
  );
}

async function handlePackageSelection(msg: any, sender: string, user: any, body: string): Promise<boolean> {
  let pkg: any = null;
  if (body === 'pilih 1' || body === 'pilih pro' || body === '1' || body === 'paket 1') pkg = PACKAGES.pro;
  if (body === 'pilih 2' || body === 'pilih unlimited' || body === '2' || body === 'paket 2') pkg = PACKAGES.unlimited;
  if (!pkg) return false;

  const { error } = await supabase.from('users').update({ is_upgrading: true, upgrade_package: pkg.key }).eq('id', sender) as any;
  if (error) throw new Error(`Gagal set upgrade: ${error.message}`);

  await safeReply(msg,
    `${pkg.emoji} *${pkg.label} - ${user.store_name}*\n\n` +
    `Transfer sebesar *${pkg.priceStr}* ke:\n💳 *${PAYMENT.bank} — ${PAYMENT.account}*\n   a/n ${PAYMENT.name}\n\n` +
    `Setelah transfer, *kirim foto bukti* di sini.\nAdmin akan verifikasi dalam 1×24 jam. ✅\n\nKetik *Batal* untuk membatalkan.`
  );
  return true;
}

async function handleTransferProof(msg: any, client: any, sender: string, user: any): Promise<void> {
  let media: any = await msg.downloadMedia().catch(() => null);
  if (!media) {
    await safeReply(msg, '❌ Gagal mengunduh gambar. Coba kirim ulang ya Bos.\n\nAtau ketik Batal untuk membatalkan.');
    return;
  }

  const pkg = (user.upgrade_package && PACKAGES[user.upgrade_package]) ? PACKAGES[user.upgrade_package] : PACKAGES.pro;

  const { error: upErr } = await supabase.from('upgrades').insert([{ user_id: sender, package: pkg.key, status: 'pending' }]) as any;
  if (upErr) throw new Error(`Gagal simpan upgrade: ${upErr.message}`);

  await supabase.from('users').update({ is_upgrading: false, upgrade_package: null }).eq('id', sender) as any;

  try {
    const admin: string = client.info?.wid?._serialized;
    if (admin) {
      await client.sendMessage(admin, media, { caption: `🚨 *PERMINTAAN UPGRADE ${pkg.label.toUpperCase()}*\n🏪 Toko   : ${user.store_name}\n📱 WA     : ${formatPhone(sender)}\n💰 Paket  : ${pkg.label} (${pkg.priceStr})\n🕐 Waktu  : ${new Date().toLocaleString('id-ID')}` });
    }
    media = null;
  } catch (e: any) { addLog('warn', `[WARN] Gagal kirim bukti ke admin: ${e.message}`); }

  await safeReply(msg, `✅ *Bukti transfer diterima!*\n\nPaket      : *${pkg.label}*\nNominal    : *${pkg.priceStr}*\n\nAdmin akan memverifikasi dalam 1×24 jam.\nNotifikasi otomatis dikirim saat akun aktif. 🚀`);
}

async function lookupBehavior(userId: string, keyword: string): Promise<{ classified_as: string; confidence: number } | null> {
  try {
    const { data, error } = await supabase
      .from('user_behavior_logs')
      .select('classified_as, confidence')
      .eq('user_id', userId)
      .eq('keyword', keyword.toLowerCase())
      .maybeSingle() as any;
    if (error || !data) return null;
    return data;
  } catch (_: any) { addLog('error', '[BEHAVIOR] getBehavior error: ' + _.message); return null; }
}

async function saveBehavior(userId: string, keyword: string, classifiedAs: string, source = 'user_confirm'): Promise<void> {
  try {
    await supabase.rpc('upsert_behavior', { p_user_id: userId, p_keyword: keyword.toLowerCase(), p_classified_as: classifiedAs, p_source: source }) as any;
  } catch (err: any) { addLog('error', `[LEARNING] Failed to save behavior: ${err.message}`); }
}

function extractAmbiguousKeywords(body: string): string[] {
  const allKeywords = new Set([...KW_KELUAR, ...KW_MASUK]);
  const words = body.split(/\s+/);
  const candidates: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (allKeywords.has(lower)) continue;
    if (parseCurrency(w) !== null) continue;
    if (parseQuantity(w) !== null) continue;
    if (lower.length < 2 || lower.length > 30) continue;
    if (/^\d/.test(lower)) continue;
    candidates.push(lower);
  }
  return candidates;
}

async function postTrxJournal(userId: string, type: string, amount: number, description: string, referenceId?: string) {
  try {
    if (type === 'masuk') {
      await accountingEngine.postJournal({
        userId, referenceType: 'manual', referenceId,
        description: description || 'Pemasukan',
        lines: [
          { accountCode: '1101', debit: amount, credit: 0, description: 'Penerimaan' },
          { accountCode: '4101', debit: 0, credit: amount, description: 'Pendapatan' },
        ],
      });
    } else if (type === 'keluar') {
      await accountingEngine.postJournal({
        userId, referenceType: 'manual', referenceId,
        description: description || 'Pengeluaran',
        lines: [
          { accountCode: '6105', debit: amount, credit: 0, description: 'Beban operasional' },
          { accountCode: '1101', debit: 0, credit: amount, description: 'Pembayaran' },
        ],
      });
    }
  } catch (e: any) {
    addLog('error', `[MSG] postJournal error: ${e.message}`);
  }
}

async function findProductInMessage(userId: string, body: string): Promise<{ id: number; name: string } | null> {
  try {
    const { data: products } = await supabase
      .from('products').select('id, name')
      .eq('user_id', userId).eq('is_active', true) as any;
    if (!products || products.length === 0) return null;
    const bodyLower = body.toLowerCase();
    for (const p of products) {
      if (p.name && bodyLower.includes(p.name.toLowerCase())) return p;
    }
    return null;
  } catch (_: any) { addLog('error', '[MSG] matchProductByName error: ' + _.message); return null; }
}

function getDashboardUrl(): string {
  return (process.env.APP_URL || 'https://nickridwan-tata-business-suite.hf.space').replace(/\/+$/, '');
}

async function classifyTransactionWithGemini(text: string): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'DUMMY_KEY') return null;
  try {
    const result = await geminiRouter.processMessageWithGemini(text);
    if (!result || !result.intent) return null;

    let type: string | null = null;
    let pembukuan: string | null = null;
    if (result.intent === 'pemasukan') type = 'masuk';
    else if (result.intent === 'pengeluaran') type = 'keluar';
    else if (result.intent === 'buat_invoice') return { type: '__invoice__', intent: 'buat_invoice', raw: result };
    else if (result.intent === 'hutang') pembukuan = 'hutang_dagang';
    else if (Object.keys(transactionRecorder.PEMBUKUAN_COA_MAP).includes(result.intent)) pembukuan = result.intent;
    else return null;

    return { type, pembukuan, items: result.items || [], customerName: result.customer_name || null, statusPayment: result.status_pembayaran || 'tunai', catatan: result.catatan || null };
  } catch (err: any) { addLog('error', '[GEMINI] Classification failed: ' + sanitizeError(err)); return null; }
}

async function handleTransaction(msg: any, sender: string, user: any, effectiveStatus: string, rawBody: string, body: string, client: any): Promise<boolean> {
  let type: string | null = null, amount: number | null = null;
  const descWords: string[] = [];

  const bodyWords = body.split(/\s+/);
  const exactMasuk = bodyWords.some((w: string) => KW_MASUK.includes(w));
  const exactKeluar = bodyWords.some((w: string) => KW_KELUAR.includes(w));
  if (exactMasuk && !exactKeluar) type = 'masuk';
  else if (exactKeluar && !exactMasuk) type = 'keluar';
  else if (KW_KELUAR.some((k: string) => body.includes(k))) type = 'keluar';
  else if (KW_MASUK.some((k: string) => body.includes(k))) type = 'masuk';

  let matchedProductKeyword: string | null = null;
  if (!type) {
    try {
      const { data: products } = await supabase.from('products').select('name').eq('user_id', sender).eq('is_active', true) as any;
      if (products) {
        for (const p of products) {
          if (p.name && body.includes(p.name.toLowerCase())) { type = 'masuk'; matchedProductKeyword = p.name.toLowerCase(); break; }
        }
      }
    } catch (_: any) { addLog('error', '[MSG] keyword matching error: ' + _.message); }
  }

  if (!type) {
    const ambiguousWords = extractAmbiguousKeywords(body);
    for (const word of ambiguousWords) {
      const learned = await lookupBehavior(sender, word);
      if (learned && learned.confidence >= 50) { type = learned.classified_as; descWords.push(`[${word}→${type}]`); break; }
    }
  }

  const candidates: { val: number; word: string }[] = [];
  for (const word of rawBody.split(/\s+/)) {
    const val = parseCurrency(word);
    if (val !== null) candidates.push({ val, word });
    else descWords.push(word);
  }

  if (candidates.length > 0) {
    const withPrefix = candidates.find(c => /^(rp|:)/i.test(c.word));
    amount = withPrefix ? withPrefix.val : Math.max(...candidates.map(c => c.val));
  }

  if (type && !amount) {
    const ex = type === 'keluar' ? '*beli stok sembako 200rb*' : '*jual nasi goreng 25rb*';
    await safeReply(msg, `❌ *Nominalnya belum ada Bos.*\n\nContoh yang benar: ${ex}\n\nFormat angka yang didukung:\n• 20rb  • 50k  • 1.5jt  • 20.000  • 1000000`);
    return true;
  }

  if (!type && amount) {
    const geminiResult = await classifyTransactionWithGemini(body);
    if (geminiResult && geminiResult.type === '__invoice__') return await handleInvoiceCommand(msg, sender, user, rawBody, client);
    if (geminiResult && geminiResult.pembukuan) {
      const finalDesc = (geminiResult.catatan || geminiResult.items?.map((i: any) => i.nama_barang).filter(Boolean).join(', ') || rawBody).trim() || 'Tanpa keterangan';
      const coaMap = transactionRecorder.PEMBUKUAN_COA_MAP[geminiResult.pembukuan];
      const pembukuanLabel = coaMap?.label || geminiResult.pembukuan;
      const result = await transactionRecorder.recordPembukuan({ userId: sender, tipe: geminiResult.pembukuan, amount: amount!, description: finalDesc, customerName: geminiResult.customerName || null });
      if (result.success) {
        await safeReply(msg, `✅ *Pembukuan Berhasil Dicatat!*\n\n📋 Tipe : ${pembukuanLabel}\n💵 Nominal : ${formatRupiah(amount)}\n${geminiResult.customerName ? `👤 Pihak : ${geminiResult.customerName}\n` : ''}📝 Keterangan : ${finalDesc}`);
        return true;
      }
      await safeReply(msg, `❌ Gagal mencatat pembukuan: ${result.error}`);
      return true;
    }
    if (geminiResult && geminiResult.type) {
      type = geminiResult.type;
      if (geminiResult.customerName) descWords.push(`[${geminiResult.customerName}]`);
      if (geminiResult.catatan) descWords.push(geminiResult.catatan);
    }
  }

  if (!type && amount) {
    const ambiguousWords = extractAmbiguousKeywords(body);
    if (ambiguousWords.length > 0) {
      pendingClassificationDialogs.set(sender, { amount, rawBody, body, ambiguousWord: ambiguousWords[0], descWords, timestamp: Date.now() });
      await safeReply(msg, `🤔 *Konfirmasi Tipe Transaksi*\n\nSaya menemukan kata "*${ambiguousWords[0]}*" dengan nominal ${formatRupiah(amount)}.\n\nIni termasuk:\n📥 *Masuk* (pemasukan/penjualan)\n📤 *Keluar* (pengeluaran/pembelian)\n\nBalas *Masuk* atau *Keluar* untuk mengonfirmasi.\nKetik *Batal* untuk membatalkan.`);
      return true;
    }
    await safeReply(msg, `❌ *Tipe transaksinya belum jelas Bos.*\n\n📥 Masuk : *jual nasi goreng ${formatRupiah(amount)}*\n📤 Keluar: *beli stok kopi ${formatRupiah(amount)}*`);
    return true;
  }

  if (!type && !amount) return false;

  if (effectiveStatus === 'demo') {
    const todayCount = await getDailyTransactionCount(sender);
    if (todayCount >= 5) {
      await safeReply(msg, `⚠️ *Limit Harian Demo Habis!*\n\nSudah *${todayCount} transaksi* hari ini.\nLimit reset otomatis besok pukul 00:00.\n\n💡 Ketik *Paket* untuk upgrade tanpa batas.`);
      return true;
    }
  }

  const finalDesc = descWords.filter((w: string) => {
    const wl = w.toLowerCase();
    return !KW_KELUAR.includes(wl) && !KW_MASUK.includes(wl) && parseCurrency(w) === null;
  }).join(' ').trim() || 'Tanpa keterangan';

  const matchedProduct = await findProductInMessage(sender, body);

  if (matchedProduct) {
    const tipeEmoji = type === 'masuk' ? '📥' : '📤';
    const tipeLabel = type === 'masuk' ? 'MASUK' : 'KELUAR';
    pendingTxConfirmations.set(sender, { type, amount, description: finalDesc, product: matchedProduct, effectiveStatus, timestamp: Date.now() });
    await safeReply(msg, `📋 *Konfirmasi Transaksi*\n\n${tipeEmoji} *${tipeLabel}*\n💵 Jumlah : ${formatRupiah(amount!)}\n📦 Produk : ${matchedProduct.name}\n📝 Ket    : ${finalDesc}\n\nBalas *Ya* untuk mencatat.\nBalas *Batal* untuk membatalkan.`);
    return true;
  }

  let productList: any[] = [];
  try {
    const { data: allProducts } = await supabase.from('products').select('id, name').eq('user_id', sender).eq('is_active', true).order('name', { ascending: true }) as any;
    productList = allProducts || [];
  } catch (_: any) { addLog('error', '[MSG] productList fetch failed: ' + _.message); }

  if (productList.length === 0) {
    const dashUrl = getDashboardUrl();
    const slug = user.store_slug || 'dashboard';
    await safeReply(msg, `❌ *Transaksi Ditolak*\n\nBelum ada produk terdaftar di inventori.\n\n📋 *Cara Mendaftar Produk:*\n1. Buka Dashboard Web:\n   ${dashUrl}/stock/${slug}\n2. Tambah produk beserta HPP awal\n3. Coba catat transaksi lagi\n\n💡 _Semua transaksi wajib merujuk produk yang terdaftar._`);
    return true;
  }

  const tipeEmoji = type === 'masuk' ? '📥' : '📤';
  const tipeLabel = type === 'masuk' ? 'MASUK' : 'KELUAR';
  let listText = productList.slice(0, 15).map((p: any, i: number) => `   ${i + 1}. ${p.name}`).join('\n');
  if (productList.length > 15) listText += `\n   _...dan ${productList.length - 15} produk lainnya_`;

  pendingProductSelections.set(sender, { type, amount, description: finalDesc, products: productList.slice(0, 15), effectiveStatus, timestamp: Date.now() });
  await safeReply(msg, `🤔 *Produk mana yang dimaksud?*\n\n${tipeEmoji} ${tipeLabel} — ${formatRupiah(amount!)}\n\nPilih produk:\n${listText}\n\nBalas *angka* untuk memilih produk.\nBalas *Batal* untuk membatalkan.`);
  return true;
}

async function handleDashboardRequest(msg: any, sender: string, user: any): Promise<boolean> {
  const appUrl = (process.env.APP_URL || 'https://nickridwan-tata-business-suite.hf.space').replace(/\/+$/, '');

  let { data: userData } = await supabase.from('users').select('dashboard_token, dashboard_token_created_at, store_slug').eq('id', sender).maybeSingle() as any;

  let token = userData?.dashboard_token;
  let slug = userData?.store_slug;

  if (!slug) {
    slug = await generateUniqueSlug(user.store_name || 'Toko Saya', supabase, sender);
    await supabase.from('users').update({ store_slug: slug }).eq('id', sender) as any;
  }

  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    await supabase.from('users').update({ dashboard_token: token, dashboard_token_created_at: new Date().toISOString() }).eq('id', sender) as any;
  }

  const link = `${appUrl}/stock/${slug}?token=${token}`;

  await safeReply(msg,
    `📊 *Dashboard Stok — ${user.store_name}*\n_Tata Business Suite_\n\n` +
    `Akses dashboard stok Anda di sini:\n🔗 ${link}\n\n` +
    `✅ *Fitur dashboard:*\n` +
    `   • Tambah, edit & hapus produk\n` +
    `   • Catat stok masuk & keluar\n` +
    `   • Stock opname (hitung fisik)\n` +
    `   • Laporan & riwayat lengkap\n\n` +
    `⚠️ Jaga kerahasiaan link ini.\n` +
    `(Disarankan Buka website di pc/laptop.)\n\n` +
    `Ketik *Token baru* jika link bermasalah.`
  );
  return true;
}

async function handleNewToken(msg: any, sender: string, user: any): Promise<boolean> {
  const appUrl = (process.env.APP_URL || 'https://nickridwan-tata-business-suite.hf.space').replace(/\/+$/, '');
  const token = crypto.randomBytes(16).toString('hex');
  await supabase.from('users').update({ dashboard_token: token, dashboard_token_created_at: new Date().toISOString() }).eq('id', sender) as any;

  let { data: userData } = await supabase.from('users').select('store_slug').eq('id', sender).maybeSingle() as any;
  let slug = userData?.store_slug;
  if (!slug) {
    slug = await generateUniqueSlug(user.store_name || 'Toko Saya', supabase, sender);
    await supabase.from('users').update({ store_slug: slug }).eq('id', sender) as any;
  }

  const link = `${appUrl}/stock/${slug}?token=${token}`;
  await safeReply(msg,
    `🔑 *Link Dashboard Baru — Tata Business Suite*\n\n` +
    `Link lama sudah tidak berlaku.\n\n` +
    `Link baru Anda:\n🔗 ${link}\n\n` +
    `Simpan link ini. Jangan bagikan ke orang lain.\n` +
    `(Disarankan Buka website di pc/laptop.)`
  );
  return true;
}

async function checkAndRegisterUser(sender: string, rawBody: string, msg: any): Promise<{ user: any; isNew: boolean }> {
  if (circuitIsOpen()) {
    addLog('warn', '[NEW USER] DB circuit open — returning virtual user');
    return { user: buildVirtualUser(sender, rawBody), isNew: true };
  }

  let { data: user, error: dbErr } = await supabase.from('users').select('*').eq('id', sender).maybeSingle() as any;

  if (dbErr && dbErr.code !== 'PGRST116') {
    const errMsg = sanitizeError(dbErr);
    if (errMsg.includes('[SUPABASE ERROR]')) circuitRecordFailure();
    addLog('error', '[MESSAGE HANDLER ERROR] DB query failed: ' + errMsg);
    return { user: buildVirtualUser(sender, rawBody), isNew: true };
  }

  if (user) { circuitRecordSuccess(); return { user, isNew: false }; }

  const isDaftar = rawBody.match(/^daftar\s+(.+)/i);

  if (!isDaftar) {
    addLog('info', `[NEW USER] Unknown sender, awaiting registration: ${sender}`);
    return { user: { id: sender, onboarding_status: 'unregistered' }, isNew: true };
  }

  let storeName = isDaftar[1].trim().substring(0, 50);
  if (!storeName) storeName = 'Toko Saya';

  addLog('info', `[NEW USER] Registering: ${sender} as "${storeName}"`);

  const slug = await generateUniqueSlug(storeName, supabase);

  const newUser: any = { id: sender, store_name: storeName, store_slug: slug, status: 'demo', is_upgrading: false, upgrade_package: null, subscription_expires_at: null, dashboard_token: null };

  let insErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: e } = await supabase.from('users').insert([newUser]) as any;
    insErr = e;
    if (!insErr) break;
    if (insErr.code === '23505') {
      const { data: existing } = await supabase.from('users').select('*').eq('id', sender).maybeSingle() as any;
      if (existing) { circuitRecordSuccess(); return { user: existing, isNew: false }; }
      continue;
    }
    break;
  }
  if (insErr) {
    const errMsg = sanitizeError(insErr);
    if (errMsg.includes('[SUPABASE ERROR]')) circuitRecordFailure();
    addLog('error', '[MESSAGE HANDLER ERROR] Insert failed: ' + errMsg);
    return { user: buildVirtualUser(sender, rawBody), isNew: true };
  }

  circuitRecordSuccess();
  newUser.onboarding_status = 'new_user';
  return { user: newUser, isNew: true };
}

function buildVirtualUser(sender: string, rawBody: string): any {
  let storeName = 'Toko Saya';
  const daftarMatch = rawBody?.match?.(/^daftar\s+(.+)/i);
  if (daftarMatch) storeName = daftarMatch[1].trim().substring(0, 50);
  return { id: sender, store_name: storeName, store_slug: null, status: 'demo', onboarding_status: 'new_user', is_upgrading: false, upgrade_package: null, subscription_expires_at: null, dashboard_token: null };
}

async function handleMessage(msg: any, client: any): Promise<any> {
  if (!msg) return;
  if (msg.from === 'status@broadcast') return;
  if (msg.from.includes('@g.us')) return;
  if (msg.from.includes('-')) return;
  if (msg.fromMe) return;

  const sender: string = msg.from;

  // Serialize per-sender to prevent race conditions on dialog maps
  return await withSenderLock(sender, async () => {
    if (msg.id && msg.id._serialized) {
      const isDuplicate = await isMessageProcessed(msg.id._serialized);
      if (isDuplicate) { addLog('info', `[DEDUP] Message ${msg.id._serialized} already processed — skip`); return; }
    }

    const rawBody: string = (msg.body || '').trim();
    let body: string = rawBody.toLowerCase();

    if (!rawBody && !msg.hasMedia) return;

  try {
    const maint = await getMaintenanceMode();
    if (maint?.active) { await safeReply(msg, maint.message); return; }

    const { user, isNew } = await checkAndRegisterUser(sender, rawBody, msg);

    if (isNew && !body.startsWith('daftar ')) {
      await safeReply(msg,
        `Halo! 👋 Tata di sini.\n` +
        `Sepertinya ini kali pertama nomor kamu terdaftar di sistem.\n\n` +
        `Selamat datang di *Tata Business Suite*! 🎉\n\n` +
        `Tata siap bantu kamu catat keuangan & stok toko dengan mudah.\n\n` +
        `Sebelum mulai, atur nama tokomu dulu ya:\n` +
        `📝 Ketik: *Daftar [Nama Toko]*\n` +
        `Contoh: *Daftar Warung Jaya*\n\n` +
        `Atau ketik *Bantuan* untuk lihat semua menu. 😊`
      );
      return;
    }

    msg.getChat?.().then((c: any) => c?.sendStateTyping()).catch(() => {});

    const isGraduatedVirtualUser = graduatedVirtualUsers.has(sender);
    if ((user?.onboarding_status === 'new_user' || user?.onboarding_status === 'onboarding') && !isGraduatedVirtualUser) {
      try { const handled = await handleOnboardingStep(msg, sender, user, body, client); if (handled) return; }
      catch (obErr: any) { addLog('error', '[ONBOARDING] State machine error: ' + obErr.message); await safeReply(msg, `⚠️ _Sesi panduan terganggu. Ketik *Batal* untuk ulang dari awal._`); return; }
    }

    const effectiveStatus = getEffectiveStatus(user);

    if (!user?.is_upgrading && msg.hasMedia) {
      const mime = (msg.type || '').toLowerCase();
      const isAudio = mime === 'ptt' || mime === 'audio';
      const isImage = mime === 'image';

      if (isAudio || isImage) {
        const loadingMsg = isAudio ? '🎙️ Sedang transkripsi suara... sebentar ya Bos.' : '📸 Sedang memindai struk... sebentar ya Bos.';
        await safeReply(msg, loadingMsg);

        try {
          let media: any = await msg.downloadMedia().catch(() => null);
          if (!media) { await safeReply(msg, '❌ Gagal mengunduh file. Coba kirim ulang ya Bos.'); }
          else {
            let result: any = null;
            if (isAudio) result = await transcribeAudio(media);
            else result = await extractTextFromImage(media);
            media = null;

            if (!result.success) {
              const errMsg = isAudio
                ? `❌ *Gagal memproses voice note*\n\n${result.error}\n\nCoba ketik pesannya langsung ya Bos.`
                : `❌ *Gagal memindai struk*\n\n${result.error}\n\nTips:\n• Foto harus terang & tidak buram\n• Arahkan kamera tegak lurus\n• Pastikan tulisan terbaca jelas`;
              await safeReply(msg, errMsg);
            } else if (!result.hasTransaction || result.confidence < 25) {
              const preview = result.text.substring(0, 120).replace(/\n/g, ' ');
              const hint = isAudio
                ? `💬 Terdengar: "_${preview}..._"\n\nSaya tidak mendeteksi transaksi keuangan di sana Bos. Coba sebut nominalnya dengan jelas, contoh: "jual nasi goreng dua puluh lima ribu".`
                : `📄 Teks terdeteksi: "_${preview}..._"\n\nSaya tidak menemukan info transaksi di struk ini Bos. Coba ketik manual, contoh: *Jual 150rb*.`;
              await safeReply(msg, hint);
            } else {
              const txHandled = await handleTransaction(msg, sender, user, effectiveStatus, result.text, result.text.toLowerCase(), client);
              if (!txHandled) {
                const preview = result.text.substring(0, 100).replace(/\n/g, ' ');
                await safeReply(msg, `📋 *Teks berhasil dibaca:*\n${preview}\n\nTapi saya belum bisa otomatis mencatat transaksinya Bos.\nCoba ketik manual: *Jual 150rb* atau *Beli bahan 75rb*`);
              }
            }
            result = null;
          }
        } catch (err: any) {
          addLog('error', `[MEDIA] Unhandled error: ${err.message} ${err.stack}`);
          await safeReply(msg, `⚠️ Ada gangguan saat memproses ${isAudio ? 'voice note' : 'foto'} Bos.\nCoba kirim ulang, atau ketik pesannya langsung.`);
        }
        return;
      }
      if (!rawBody) {
        await safeReply(msg, `📎 *File tidak didukung*\n\nSaya hanya bisa memproses:\n🎙️ Voice note (pesan suara)\n📸 Foto struk/nota\n\nAtau ketik pesan teks langsung, contoh: *jual nasi goreng 25rb*`);
        return;
      }
    }

    if (user?.is_upgrading && msg.hasMedia) { handleTransferProof(msg, client, sender, user); return; }

    if (user?.is_upgrading && !msg.hasMedia) {
      const isGlobalCmd = KW_STATUS.some((k: string) => body === k) || KW_LAPORAN.some((k: string) => body === k || body.startsWith(k)) || KW_BANTUAN.some((k: string) => body === k);
      if (!isGlobalCmd) {
        if (KW_BATAL.some((k: string) => body === k || body.includes(k))) {
          await supabase.from('users').update({ is_upgrading: false, upgrade_package: null }).eq('id', sender) as any;
          await safeReply(msg, `✅ Proses upgrade dibatalkan.\n\nKetik *Paket* kapan saja untuk memulai lagi.`);
          return;
        }
        const pkgKey = user?.upgrade_package && PACKAGES[user.upgrade_package] ? user.upgrade_package : null;
        if (!pkgKey) {
          await supabase.from('users').update({ is_upgrading: false, upgrade_package: null }).eq('id', sender) as any;
          await safeReply(msg, `⚠️ Sesi upgrade tidak ditemukan Bos.\n\nKetik *Paket* untuk memilih paket lagi.`);
          return;
        }
        const pkg = PACKAGES[pkgKey];
        await safeReply(msg, `📸 *Bos, kirim foto bukti transfer dulu ya!*\n\nPaket dipilih : *${pkg.label}*\nNominal       : *${pkg.priceStr}*\n\nTransfer ke:\n💳 *${PAYMENT.bank} — ${PAYMENT.account}*\n   a/n ${PAYMENT.name}\n\nAtau ketik *Batal* untuk membatalkan.`);
        return;
      }
    }

    function shouldBypassDialogs(bodyText: string): boolean {
      if (/\b(?:tagih|kirim\s+tagihan|minta\s+bayar|buat\s+(?:invoice|tagihan|bon)|invoice|nagih)\b/i.test(bodyText)) return true;
      if (/\b(?:setbank|atur\s+rekening|setting\s+bank|set\s+bank)\b/i.test(bodyText)) return true;
      if (KW_DASHBOARD.some((k: string) => bodyText === k || bodyText.includes(k))) return true;
      if (KW_STATUS.some((k: string) => bodyText === k)) return true;
      if (KW_LAPORAN.some((k: string) => bodyText === k || bodyText.startsWith(k))) return true;
      if (KW_BANTUAN.some((k: string) => bodyText === k)) return true;
      if (KW_UPGRADE.some((k: string) => bodyText === k) || bodyText === 'paket') return true;
      return false;
    }

    if (pendingTxConfirmations.has(sender) && !shouldBypassDialogs(body)) {
      const txConf = pendingTxConfirmations.get(sender);
      if (Date.now() - txConf.timestamp > 5 * 60 * 1000) { pendingTxConfirmations.delete(sender); }
      else {
        if (KW_BATAL.some((k: string) => body === k)) { pendingTxConfirmations.delete(sender); await safeReply(msg, '✅ Transaksi dibatalkan.'); return; }
        const isYes = ['ya', 'ya sudah', 'iya', 'oke', 'ok', 'yes', 'y', '1', 'catat', 'simpan'].includes(body);
        if (isYes) {
          pendingTxConfirmations.delete(sender);
          if (txConf.effectiveStatus === 'demo') {
            const todayCount = await getDailyTransactionCount(sender);
            if (todayCount >= 5) { await safeReply(msg, `⚠️ *Limit Harian Demo Habis!*\n\nSudah *${todayCount} transaksi* hari ini.\nLimit reset otomatis besok pukul 00:00.\n\n💡 Ketik *Paket* untuk upgrade tanpa batas.`); return; }
          }
          const trxResult = await transactionRecorder.recordTransactionWithJournal(sender, txConf.type, txConf.amount, txConf.description, txConf.product.id, txConf.effectiveStatus === 'demo');
          if (!trxResult.success) throw new Error(`Gagal simpan transaksi: ${trxResult.error}`);
          const emoji = txConf.type === 'masuk' ? '✅' : '💸';
          const tipeLabel = txConf.type === 'masuk' ? '📥 MASUK' : '📤 KELUAR';
          let extraInfo = '';
          if (txConf.effectiveStatus === 'demo') { const todayCount = await getDailyTransactionCount(sender); const sisa = 5 - todayCount; extraInfo = `\n\n⏳ Sisa kuota hari ini: *${sisa} transaksi*`; }
            await safeReply(msg, `${emoji} *Berhasil Dicatat!*\n\n${tipeLabel}\n💵 Jumlah : ${formatRupiah(txConf.amount)}\n📦 Produk : ${txConf.product!.name}\n📝 Ket    : ${txConf.description}${extraInfo}`);
          return;
        }
        await safeReply(msg, `⚠️ Balas *Ya* untuk mencatat atau *Batal* untuk membatalkan.`);
        return;
      }
    }

    if (pendingProductSelections.has(sender) && !shouldBypassDialogs(body)) {
      const sel = pendingProductSelections.get(sender);
      if (Date.now() - sel.timestamp > 5 * 60 * 1000) { pendingProductSelections.delete(sender); }
      else {
        if (KW_BATAL.some((k: string) => body === k)) { pendingProductSelections.delete(sender); await safeReply(msg, '✅ Transaksi dibatalkan.'); return; }
        const choiceIdx = parseInt(body) - 1;
        if (!isNaN(choiceIdx) && choiceIdx >= 0 && choiceIdx < sel.products.length) {
          const selectedProduct = sel.products[choiceIdx];
          pendingProductSelections.delete(sender);
          if (sel.effectiveStatus === 'demo') {
            const todayCount = await getDailyTransactionCount(sender);
            if (todayCount >= 5) { await safeReply(msg, `⚠️ *Limit Harian Demo Habis!*\n\nSudah *${todayCount} transaksi* hari ini.\nLimit reset otomatis besok pukul 00:00.\n\n💡 Ketik *Paket* untuk upgrade tanpa batas.`); return; }
          }
          const trxResult = await transactionRecorder.recordTransactionWithJournal(sender, sel.type, sel.amount, sel.description, selectedProduct.id, sel.effectiveStatus === 'demo');
          if (!trxResult.success) throw new Error(`Gagal simpan transaksi: ${trxResult.error}`);
          const emoji = sel.type === 'masuk' ? '✅' : '💸';
          const tipeLabel = sel.type === 'masuk' ? '📥 MASUK' : '📤 KELUAR';
          let extraInfo = '';
          if (sel.effectiveStatus === 'demo') { const todayCount = await getDailyTransactionCount(sender); const sisa = 5 - todayCount; extraInfo = `\n\n⏳ Sisa kuota hari ini: *${sisa} transaksi*`; }
          await safeReply(msg, `${emoji} *Berhasil Dicatat!*\n\n${tipeLabel}\n💵 Jumlah : ${formatRupiah(sel.amount)}\n📦 Produk : ${selectedProduct.name}\n📝 Ket    : ${sel.description}${extraInfo}`);
          return;
        }
        const nameMatch = sel.products.find((p: any) => body.toLowerCase().includes(p.name.toLowerCase()));
        if (nameMatch) {
          pendingProductSelections.delete(sender);
          if (sel.effectiveStatus === 'demo') {
            const todayCount = await getDailyTransactionCount(sender);
            if (todayCount >= 5) { await safeReply(msg, `⚠️ *Limit Harian Demo Habis!*\n\nSudah *${todayCount} transaksi* hari ini.`); return; }
          }
          const trxResult = await transactionRecorder.recordTransactionWithJournal(sender, sel.type, sel.amount, sel.description, nameMatch.id, sel.effectiveStatus === 'demo');
          if (!trxResult.success) throw new Error(`Gagal simpan transaksi: ${trxResult.error}`);
          const emoji = sel.type === 'masuk' ? '✅' : '💸';
          const tipeLabel = sel.type === 'masuk' ? '📥 MASUK' : '📤 KELUAR';
          await safeReply(msg, `${emoji} *Berhasil Dicatat!*\n\n${tipeLabel}\n💵 Jumlah : ${formatRupiah(sel.amount)}\n📦 Produk : ${nameMatch.name}\n📝 Ket    : ${sel.description}`);
          return;
        }
        await safeReply(msg, `⚠️ Pilihan tidak valid. Balas *angka 1-${sel.products.length}* untuk memilih produk, atau *Batal* untuk membatalkan.`);
        return;
      }
    }

    if (pendingSaleDialogs.has(sender) && !shouldBypassDialogs(body)) {
      const dialog = pendingSaleDialogs.get(sender);
      if (Date.now() - dialog.timestamp > 5 * 60 * 1000) { pendingSaleDialogs.delete(sender); }
      else {
        if (KW_BATAL.some((k: string) => body === k)) { pendingSaleDialogs.delete(sender); await safeReply(msg, '✅ Proses penjualan dibatalkan.'); return; }
        const choiceIndex = parseInt(body) - 1;
        if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < dialog.products.length) {
          const product = dialog.products[choiceIndex];
          const qty = dialog.qty;
          const channel = dialog.channel || 'Offline';
          pendingSaleDialogs.delete(sender);
          await processSaleExecution(msg, sender, user, product, qty, channel);
          return;
        } else {
          await safeReply(msg, `⚠️ Pilihan tidak valid. Silakan balas dengan *angka 1-${dialog.products.length}* atau ketik *Batal*.`);
          return;
        }
      }
    }

    if (pendingClassificationDialogs.has(sender) && !shouldBypassDialogs(body)) {
      const cDialog = pendingClassificationDialogs.get(sender);
      if (Date.now() - cDialog.timestamp > 5 * 60 * 1000) { pendingClassificationDialogs.delete(sender); }
      else {
        if (KW_BATAL.some((k: string) => body === k)) { pendingClassificationDialogs.delete(sender); await safeReply(msg, '✅ Konfirmasi dibatalkan.'); return; }

        let confirmedType: string | null = null;
        if (body === 'masuk' || body === 'pemasukan' || body === '1') confirmedType = 'masuk';
        else if (body === 'keluar' || body === 'pengeluaran' || body === '2') confirmedType = 'keluar';

        if (confirmedType) {
          await saveBehavior(sender, cDialog.ambiguousWord, confirmedType, 'user_confirm');
          pendingClassificationDialogs.delete(sender);

          if (effectiveStatus === 'demo') {
            const todayCount = await getDailyTransactionCount(sender);
            if (todayCount >= 5) { await safeReply(msg, `⚠️ *Limit Harian Demo Habis!*\n\nSudah *${todayCount} transaksi* hari ini.\nLimit reset otomatis besok pukul 00:00.\n\n💡 Ketik *Paket* untuk upgrade tanpa batas.`); return; }
          }

          const finalDesc = cDialog.descWords.filter((w: string) => {
            const wl = w.toLowerCase();
            return !KW_KELUAR.includes(wl) && !KW_MASUK.includes(wl) && parseCurrency(w) === null;
          }).join(' ').trim() || cDialog.ambiguousWord;

          const matchedProductCD = await findProductInMessage(sender, cDialog.body || cDialog.rawBody || '');
          if (matchedProductCD) {
            const trxResult = await transactionRecorder.recordTransactionWithJournal(sender, confirmedType, cDialog.amount, finalDesc, String(matchedProductCD.id), effectiveStatus === 'demo');
            if (!trxResult.success) throw new Error(`Gagal simpan transaksi: ${trxResult.error}`);

            const emoji = confirmedType === 'masuk' ? '✅' : '💸';
            const tipeLabel = confirmedType === 'masuk' ? '📥 MASUK' : '📤 KELUAR';
            let extraInfo = `\n\n🧠 _Saya akan mengingat "${cDialog.ambiguousWord}" sebagai ${confirmedType} untuk selanjutnya._`;
            if (effectiveStatus === 'demo') { const todayCount = await getDailyTransactionCount(sender); const sisa = 5 - todayCount; extraInfo += `\n⏳ Sisa kuota hari ini: *${sisa} transaksi*`; }
            await safeReply(msg, `${emoji} *Berhasil Dicatat!*\n\n${tipeLabel}\n💵 Jumlah : ${formatRupiah(cDialog.amount)}\n📦 Produk : ${matchedProductCD.name}\n📝 Ket    : ${finalDesc}${extraInfo}`);
            return true;
          }

          let productListCD: any[] = [];
          try {
            const { data: allProds } = await supabase.from('products').select('id, name').eq('user_id', sender).eq('is_active', true).order('name', { ascending: true }) as any;
            productListCD = allProds || [];
          } catch (_: any) { addLog('error', '[MSG] productListCD fetch failed: ' + _.message); }

          if (productListCD.length === 0) {
            const dashUrl = getDashboardUrl();
            const slug = user.store_slug || 'dashboard';
            await safeReply(msg, `❌ *Transaksi Ditolak*\n\nBelum ada produk terdaftar di inventori.\n\n📋 Daftarkan produk di Dashboard:\n   ${dashUrl}/stock/${slug}\n\n💡 _Semua transaksi wajib merujuk produk yang terdaftar._`);
            return;
          }

          const tipeEmojiCD = confirmedType === 'masuk' ? '📥' : '📤';
          const tipeLabelCD = confirmedType === 'masuk' ? 'MASUK' : 'KELUAR';
          let listTextCD = productListCD.slice(0, 15).map((p: any, i: number) => `   ${i + 1}. ${p.name}`).join('\n');
          if (productListCD.length > 15) listTextCD += `\n   _...dan ${productListCD.length - 15} produk lainnya_`;

          pendingProductSelections.set(sender, { type: confirmedType, amount: cDialog.amount, description: finalDesc, products: productListCD.slice(0, 15), effectiveStatus, timestamp: Date.now() });
          await safeReply(msg, `🤔 *Produk mana yang dimaksud?*\n\n${tipeEmojiCD} ${tipeLabelCD} — ${formatRupiah(cDialog.amount)}\n\nPilih produk:\n${listTextCD}\n\nBalas *angka* untuk memilih produk.\nBalas *Batal* untuk membatalkan.`);
          return;
        } else {
          await safeReply(msg, `⚠️ Jawaban tidak valid. Balas *Masuk* atau *Keluar* untuk mengonfirmasi.`);
          return;
        }
      }
    }

    if (KW_DASHBOARD.some((k: string) => body === k || body.includes(k))) return handleDashboardRequest(msg, sender, user);
    if (body === 'token baru' || body === 'reset token' || body === 'link baru') return handleNewToken(msg, sender, user);

    if (KW_STOCK.some((k: string) => body.includes(k)) || KW_DASHBOARD.some((k: string) => body === k || body.includes(k))) {
      if (['pro', 'unlimited'].includes(effectiveStatus)) {
        const parts = body.split(/\s+/);
        if (parts.length >= 2) {
          const possibleSku = parts.find((w: string) => /^[A-Z0-9\-]{3,}/i.test(w));
          if (possibleSku) {
            const prodResult = await stockManager.getProduct(sender, possibleSku) as any;
            if (prodResult.success) {
              const p: any = prodResult.product;
              const stock = parseFloat(p.stock_current);
              const min = parseFloat(p.stock_min);
              let statusIcon = stock <= 0 ? '🔴' : stock <= min ? '⚠️' : '🟢';
              await safeReply(msg,
                `${statusIcon} *${p.name}*\n\n` +
                `SKU  : ${p.sku}\n` +
                `Stok : *${stockManager.formatQty(stock, p.unit)} ${p.unit}*\n` +
                `Min  : ${stockManager.formatQty(min, p.unit)} ${p.unit}\n\n` +
                `Untuk kelola stok lengkap, buka dashboard:\n` +
                `Ketik *Dashboard* untuk dapat link.`
              );
              return;
            }
          }
        }
        return handleDashboardRequest(msg, sender, user);
      } else {
        await safeReply(msg, `🔒 *Fitur Stock Opname*\n\nTersedia untuk paket *PRO* & *UNLIMITED*.\n\nKetik *Paket* untuk upgrade.`);
        return;
      }
    }

    if (KW_UPGRADE.some((k: string) => body === k) || body === 'paket') { showUpgradeMenu(msg, user, effectiveStatus); return; }
    if (body.startsWith('pilih ')) { const handled = await handlePackageSelection(msg, sender, user, body); if (handled) return; }
    if (KW_BATAL.some((k: string) => body === k)) { await safeReply(msg, `Tidak ada proses yang sedang berjalan Bos. 😊\n\nKetik *Bantuan* untuk melihat menu.`); return; }

    // ── TIER 1 — Direct expense commands (gaji, listrik, sewa, dll) ──
    const ACCOUNT_LABELS: Record<string, string> = {
      '1101': 'Kas', '1102': 'Piutang Dagang', '1201': 'Inventori (Barang)',
      '2101': 'Hutang Dagang',
      '3101': 'Modal Pemilik', '3102': 'Prive (Pribadi)',
      '4101': 'Pendapatan Penjualan',
      '5101': 'Harga Pokok Penjualan (HPP)',
      '6101': 'Beban Gaji', '6102': 'Beban Sewa', '6103': 'Beban Listrik & Air',
      '6104': 'Beban Transport', '6105': 'Beban Operasional',
    };
    const BEBAN_REGEX_MAP: Record<string, RegExp> = {
      beban_gaji:        /^(?:gaji|gajian|upah)\s+/i,
      beban_sewa:        /^(?:sewa|kontrak|sewa tempat|sewa gedung|sewa ruko)\s+/i,
      beban_listrik_air: /^(?:listrik|air|pln|pdam|tagihan listrik|token listrik)\s+/i,
      beban_transport:   /^(?:transport|bensin|ojek|ongkir|kirim|pengiriman|bbm)\s+/i,
      beban_operasional: /^(?:operasional|atk|kebersihan|logistik|perlengkapan)\s+/i,
      modal:             /^(?:setor modal|modal|tambah modal|investasi|setor)\s+/i,
      prive:             /^(?:prive|ambil|ambil uang|pribadi|tarik)\s+/i,
    };
    const bebanEntry = Object.entries(BEBAN_REGEX_MAP).find(([_, re]) => re.test(body));
    if (bebanEntry) {
      const [tipe] = bebanEntry;
      const bebanAmount = parseCurrency(rawBody);
      if (!bebanAmount || bebanAmount <= 0) {
        const map = transactionRecorder.PEMBUKUAN_COA_MAP[tipe];
        await safeReply(msg, `Berapa nominal ${map?.label || tipe}? Contoh: *${tipe.replace(/_/g, ' ')} 500.000*`);
        return;
      }
      if (!['pro', 'unlimited'].includes(effectiveStatus)) {
        await safeReply(msg, `🔒 Fitur Pembukuan tersedia untuk paket *PRO* & *UNLIMITED*.\n\nKetik *Paket* untuk upgrade.`);
        return;
      }
      const bebanResult = await transactionRecorder.recordPembukuan({
        userId: sender, tipe, amount: bebanAmount, description: body,
      });
      if (bebanResult.success) {
        const map = transactionRecorder.PEMBUKUAN_COA_MAP[tipe];
        const debitLabel = (map && ACCOUNT_LABELS[map.debit]) || map?.debit || 'Kas';
        const creditLabel = (map && ACCOUNT_LABELS[map.credit]) || map?.credit || 'Kas';
        await safeReply(msg,
          `✅ *${map?.label || tipe} Dicatat*\n\n` +
          `💵 Nominal: ${formatRupiah(bebanAmount)}\n\n` +
          `📒 *Debit*:  ${debitLabel} — ${formatRupiah(bebanAmount)}\n` +
          `📒 *Kredit*: ${creditLabel} — ${formatRupiah(bebanAmount)}\n\n` +
          `Ketik *Laporan* untuk rekap harian.`
        );
      } else {
        await safeReply(msg, `❌ Gagal: ${bebanResult.error}`);
      }
      return;
    }

    // ── "stok [produk]" — Cek stock produk by name ──
    const stokSearch = body.match(/^stok\s+(.+)/i);
    if (stokSearch) {
      const searchQuery = stokSearch[1].trim().toLowerCase();
      try {
        const { data: products } = await supabase
          .from('products').select('name, stock_current, stock_min, unit')
          .eq('user_id', sender).ilike('name', `%${searchQuery}%`).eq('is_active', true).limit(5) as any;
        if (!products || products.length === 0) {
          await safeReply(msg, `❌ Produk "${searchQuery}" tidak ditemukan.\n\nKetik *Stock list* untuk lihat semua produk.`);
          return;
        }
        let stokText = `📦 *Stok — ${searchQuery}*\n${'─'.repeat(20)}\n`;
        products.forEach((p: any) => {
          const icon = p.stock_current <= 0 ? '🔴' : p.stock_min && p.stock_current <= p.stock_min ? '🟡' : '🟢';
          stokText += `\n${icon} *${p.name}*: ${p.stock_current} ${p.unit || ''}`;
          if (p.stock_min) stokText += ` (min ${p.stock_min})`;
        });
        await safeReply(msg, stokText);
      } catch (e: any) {
        addLog('error', `[STOK] Error: ${e.message}`);
        await safeReply(msg, `❌ Gagal cek stok. Coba lagi nanti.`);
      }
      return;
    }

    // ── "stok habis" / "stok kritis" ──
    if (body === 'stok habis' || body === 'stok kritis' || body === 'stock habis') {
      try {
        const { data: allProducts } = await supabase
          .from('products').select('name, stock_current, stock_min, unit')
          .eq('user_id', sender).eq('is_active', true).order('stock_current', { ascending: true }).limit(20) as any;
        const kritis = (allProducts || []).filter((p: any) => !p.stock_min || p.stock_current <= p.stock_min);
        if (kritis.length === 0) {
          await safeReply(msg, `✅ Stok aman. Semua produk tersedia cukup.`);
          return;
        }
        let kritisText = `⚠️ *Stok Kritis*\n${'─'.repeat(20)}\n`;
        kritis.forEach((p: any) => {
          const icon = p.stock_current <= 0 ? '🔴' : '🟡';
          kritisText += `\n${icon} *${p.name}*: ${p.stock_current} ${p.unit || ''}${p.stock_min ? ` (min ${p.stock_min})` : ''}`;
        });
        await safeReply(msg, kritisText);
      } catch (e: any) {
        addLog('error', `[STOK-KRITIS] Error: ${e.message}`);
        await safeReply(msg, `❌ Gagal cek stok kritis.`);
      }
      return;
    }

    // ── "rekap" / "ringkasan" — 1 command lihat kondisi bisnis ──
    if (body === 'rekap' || body === 'ringkasan' || body === 'rekapan') {
      try {
        const { data: allTrans } = await supabase.from('transactions').select('type, amount').eq('user_id', sender) as any;
        let totalMasuk = 0, totalKeluar = 0;
        (allTrans || []).forEach((t: any) => {
          const v = Number(t.amount) || 0;
          if (t.type === 'masuk') totalMasuk += v; else totalKeluar += v;
        });
        const rekapSaldo = totalMasuk - totalKeluar;

        const { data: hutangData } = await supabase
          .from('accounts_payable').select('nominal_hutang, jumlah_dibayar')
          .eq('user_id', sender).eq('status_lunas', false) as any;
        const totalHutang = (hutangData || []).reduce((s: number, h: any) => s + Number(h.nominal_hutang) - Number(h.jumlah_dibayar || 0), 0);

        const { data: prodData } = await supabase
          .from('products').select('stock_current, stock_min').eq('user_id', sender).eq('is_active', true) as any;
        const kritisCount = (prodData || []).filter((p: any) => p.stock_min && p.stock_current <= p.stock_min).length;
        const habisCount = (prodData || []).filter((p: any) => p.stock_current <= 0).length;

        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const { data: todayTrx } = await supabase
          .from('transactions').select('amount').eq('user_id', sender).gte('created_at', todayStart.toISOString()) as any;
        const omzetHariIni = (todayTrx || []).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

        let rekapText =
          `📊 *REKAP BISNIS — ${user.store_name}*\n` +
          `${'─'.repeat(24)}\n\n` +
          `💰 *Saldo Kas:* ${formatRupiah(rekapSaldo)}\n` +
          `📈 *Omzet Hari Ini:* ${formatRupiah(omzetHariIni)}\n` +
          `💳 *Total Hutang:* ${formatRupiah(totalHutang)}\n` +
          `📦 Stok Kritis: ${kritisCount} produk 🟡\n` +
          `🔴 Stok Habis: ${habisCount} produk\n\n` +
          `${'─'.repeat(24)}\n\n` +
          `Ketik *Laporan* untuk detail transaksi hari ini.`;
        await safeReply(msg, rekapText);
      } catch (e: any) {
        addLog('error', `[REKAP] Error: ${e.message}`);
        await safeReply(msg, `❌ Gagal memuat rekap. Coba lagi nanti.`);
      }
      return;
    }

    if (body === 'saldo' || body === 'cek saldo' || body === 'berea saldo' || body === 'saldo berapa' || body === 'kas' || body === 'cek kas') {
      try {
        const { data: trans } = await supabase.from('transactions').select('type, amount').eq('user_id', sender) as any;
        let totalMasuk = 0, totalKeluar = 0;
        (trans || []).forEach((t: any) => {
          const v = Number(t.amount) || 0;
          if (t.type === 'masuk') totalMasuk += v; else totalKeluar += v;
        });
        const saldo = totalMasuk - totalKeluar;
        await safeReply(msg,
          `💰 *Saldo Kas — ${user.store_name}*\n` +
          `${'─'.repeat(24)}\n\n` +
          `🟢 Pemasukan: ${formatRupiah(totalMasuk)}\n` +
          `🔴 Pengeluaran: ${formatRupiah(totalKeluar)}\n\n` +
          `${'─'.repeat(24)}\n` +
          `${saldo >= 0 ? `✅ *Saldo: ${formatRupiah(saldo)}*` : `🔴 *Defisit: -${formatRupiah(Math.abs(saldo))}*`}\n\n` +
          `Ketik *Laporan* untuk detail harian.`
        );
      } catch (e: any) {
        addLog('error', `[SALDO] Error: ${e.message}`);
        await safeReply(msg, `❌ Gagal cek saldo. Coba lagi nanti Bos.`);
      }
      return;
    }

    if (body === 'hutang' || body === 'cek hutang' || body === 'hutang supplier' || body === 'utang') {
      try {
        if (!['pro', 'unlimited'].includes(effectiveStatus)) {
          await safeReply(msg, `🔒 *Fitur Hutang*\n\nTersedia untuk paket *PRO* & *UNLIMITED*.\n\nKetik *Paket* untuk upgrade.`);
          return;
        }
        const { data: list } = await supabase
          .from('accounts_payable').select('*').eq('user_id', sender)
          .eq('status_lunas', false).order('jatuh_tempo', { ascending: true }) as any;
        if (!list || list.length === 0) {
          await safeReply(msg, `✅ *Hutang — ${user.store_name}*\n\nTidak ada hutang ke supplier saat ini.`);
          return;
        }
        const now = new Date();
        const total = list.reduce((s: number, h: any) => s + Number(h.nominal_hutang) - Number(h.jumlah_dibayar || 0), 0);
        let text =
          `💳 *Hutang ke Supplier — ${user.store_name}*\n` +
          `${'─'.repeat(24)}\n`;
        list.slice(0, 10).forEach((h: any) => {
          const sisa = Number(h.nominal_hutang) - Number(h.jumlah_dibayar || 0);
          const overdue = h.jatuh_tempo && new Date(h.jatuh_tempo) < now ? ' ⏰' : '';
          text += `\n• *${h.nama_supplier}*${overdue}\n  Sisa: ${formatRupiah(Math.max(0, sisa))}`;
          if (h.jatuh_tempo) text += `\n  Jatuh tempo: ${new Date(h.jatuh_tempo).toLocaleDateString('id-ID')}`;
        });
        if (list.length > 10) text += `\n\n...dan ${list.length - 10} hutang lainnya`;
        text += `\n\n${'─'.repeat(24)}\nTotal: *${formatRupiah(Math.max(0, total))}*\n\nKetik *Dashboard* untuk kelola hutang via web.`;
        await safeReply(msg, text);
      } catch (e: any) {
        addLog('error', `[HUTANG] Error: ${e.message}`);
        await safeReply(msg, `❌ Gagal cek hutang. Coba lagi nanti Bos.`);
      }
      return;
    }

    if (KW_STATUS.some((k: string) => body === k)) {
      let statusBlock = '';
      if (effectiveStatus === 'demo') {
        const todayCount = await getDailyTransactionCount(sender);
        statusBlock = `🎯 *Status:* 🆓 FREE DEMO\n📊 *Kuota:* ${todayCount}/5 transaksi hari ini\n\n💡 _Ketik *Paket* untuk upgrade ke fitur penuh._`;
      } else if (effectiveStatus === 'pro') {
        const sisa = getDaysRemaining(user);
        statusBlock = `🎯 *Status:* ⭐ PRO BULANAN\n📅 *Masa Aktif:* Sisa ${sisa} hari lagi`;
      } else { statusBlock = `🎯 *Status:* 💎 UNLIMITED SELAMANYA`; }
      const statusMessage =
        `ℹ️ *INFO AKUN — ${user.store_name.toUpperCase()}*\n` +
        `${'─'.repeat(24)}\n\n` +
        `🏪 *Toko:* ${user.store_name}\n` +
        `📱 *WhatsApp:* ${formatPhone(sender)}\n\n` +
        `${statusBlock}\n\n` +
        `${'─'.repeat(24)}\n` +
        `_Gunakan bot ini untuk mempermudah pencatatan bisnis Anda. Semangat, Bos!_`;
      await safeReply(msg, statusMessage);
      return;
    }

    if (KW_LAPORAN.some((k: string) => body === k || body.startsWith(k))) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const sent = await sendReport(client, sender, user.store_name, 'Harian (Manual)', todayStart.toISOString());
      if (!sent) {
        await safeReply(msg,
          `📊 *LAPORAN — ${user.store_name.toUpperCase()}*\n` +
          `${'─'.repeat(24)}\n\n` +
          `Belum ada transaksi tercatat untuk hari ini, Bos.\n\n` +
          `💡 *Tips:*\n` +
          `Mulai catat transaksi dengan mengetik langsung:\n` +
          `Contoh: *Jual Barang 1.5jt*`
        );
        return;
      }
      return;
    }

    if (KW_BANTUAN.some((k: string) => body === k)) {
      let statusNote = '';
      if (effectiveStatus === 'demo') { const todayCount = await getDailyTransactionCount(sender); statusNote = `⚠️ _Mode DEMO: ${todayCount}/5 transaksi hari ini._`; }
      else if (effectiveStatus === 'pro') { const sisa = getDaysRemaining(user); statusNote = `⭐ _PRO aktif, sisa ${sisa} hari._`; }
      else { statusNote = `💎 _UNLIMITED aktif selamanya._`; }
      await safeReply(msg,
        `Halo! 👋 Ini buku saku asisten digitalmu. Mau catat apa hari ini?\n\n` +
        `${statusNote}\n\n` +
        `💰 *CATAT UANG & JUALAN*\n` +
        `• Jualan di toko fisik? Ketik:\n` +
        `  *Jual [barang] [jumlah]*\n` +
        `  Contoh: *Jual vitamin 2*\n` +
        `• Jualan dari online? Tambahin nama aplikasinya:\n` +
        `  *Jual Tokped [barang] [jumlah]*\n` +
        `  (Bisa pakai: *Tokped*, *TikTok*, *Lazada*, *Shopee*)\n` +
        `  Contoh: *Jual Tokped serum 3*\n` +
        `• Catat pengeluaran toko? Ketik:\n` +
        `  *Beli [keterangan] [nominal]*\n` +
        `  Contoh: *Beli lakban 30rb*\n\n` +
        `🧾 *KIRIM TAGIHAN (INVOICE)*\n` +
        `• Ketik: *Tagih [nominal] ke [nomor WA]*\n` +
        `  Contoh: *Tagih 150rb ke 08123456789*\n\n` +
        `📦 *CEK GUDANG*\n` +
        `• *Stock list* ➡️ Lihat sisa semua barang\n` +
        `• *Masuk [SKU] [jumlah]* ➡️ Tambah stok barang datang\n` +
        `• *Keluar [SKU] [jumlah]* ➡️ Kurangi stok barang rusak/hilang\n\n` +
        `📋 *LAINNYA*\n` +
        `• *Laporan* — Rekap transaksi hari ini\n` +
        `• *Status* — Info & status akun\n` +
        `• *Paket* — Opsi upgrade & langganan\n\n` +
        `💡 *TIPS:* Angka bisa diketik bebas, contoh: *20rb*, *1.5jt*, *20000*.`
      );
      return;
    }

    const setbankIntent = /\b(?:setbank|atur\s+rekening|setting\s+bank|set\s+bank)\b/i.test(body);
    if (setbankIntent) return handleSetBankCommand(msg, sender, user, rawBody);

    const tagihIntent = /\b(?:tagih|kirim\s+tagihan|minta\s+bayar|buat\s+(?:invoice|tagihan|bon)|invoice|nagih)\b/i;
    if (tagihIntent.test(body)) return handleInvoiceCommand(msg, sender, user, rawBody, client);

    const saleMatch = rawBody.match(/^(?:jual|laku|terjual|sold)\s+(?:(tokped|tiktok(?:\s*shop)?|lazada|shopee)\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s*(pcs|kg|gram|liter|buah|bungkus|pack|box|dus|karton|sak|meter|cm|mm)?$/i);
    if (saleMatch) {
      const channelRaw = saleMatch[1] || null;
      const ch = channelRaw ? channelRaw.trim().replace(/\s+/g, '').toLowerCase() : 'offline';
      const channelMap: Record<string, string> = { tokped: 'Tokopedia', tiktokshop: 'TikTok Shop', tiktok: 'TikTok Shop', lazada: 'Lazada', shopee: 'Shopee', offline: 'Offline' };
      const channelName = channelMap[ch] || 'Offline';
      const productQuery = saleMatch[2].trim();
      const quantityStr = saleMatch[3] || '1';
      const unitStr = saleMatch[4] || null;
      await handleSaleCommand(msg, sender, user, productQuery, quantityStr, unitStr, channelName);
      return;
    }

    const txHandled = await handleTransaction(msg, sender, user, effectiveStatus, rawBody, body, client);
    if (txHandled) return;

    if (body === '1') {
      await safeReply(msg,
        `💰 *Catat Transaksi — ${user.store_name}*\n\n` +
        `Ketik langsung, contoh:\n\n` +
        `📥 Pemasukan: *jual nasi goreng 25rb*\n` +
        `📤 Pengeluaran: *beli stok kopi 500rb*\n\n` +
        `🧾 Tagihan: *tagih 150rb ke 08123456*\n\n` +
        `Ketik *Bantuan* untuk panduan lengkap.`
      );
      return;
    }
    if (body === '2') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const sent = await sendReport(client, sender, user.store_name, 'Harian (Manual)', todayStart.toISOString());
      if (!sent) {
        await safeReply(msg,
          `📊 Belum ada transaksi hari ini, Bos.\n\n` +
          `Mulai catat: *jual nasi goreng 25rb*`
        );
        return;
      }
      return;
    }
    if (body === '3') { const statusMsg = buildStatusMessage(user, effectiveStatus, sender); await safeReply(msg, statusMsg); return; }
    if (body === '4') {
      let statusNote = '';
      if (effectiveStatus === 'demo') { const todayCount = await getDailyTransactionCount(sender); statusNote = `⚠️ _Mode DEMO: ${todayCount}/5 transaksi hari ini._`; }
      else if (effectiveStatus === 'pro') { const sisa = getDaysRemaining(user); statusNote = `⭐ _PRO aktif, sisa ${sisa} hari._`; }
      else { statusNote = `💎 _UNLIMITED aktif selamanya._`; }
      await safeReply(msg,
        `Halo! 👋 Ini buku saku asisten digitalmu. Mau catat apa hari ini?\n\n` +
        `${statusNote}\n\n` +
        `💰 *CATAT UANG & JUALAN*\n` +
        `• Jualan di toko fisik? Ketik:\n  *Jual [barang] [jumlah]*\n  Contoh: *Jual vitamin 2*\n` +
        `• Jualan dari online? Tambahin nama aplikasinya:\n  *Jual Tokped [barang] [jumlah]*\n  (Bisa pakai: *Tokped*, *TikTok*, *Lazada*, *Shopee*)\n  Contoh: *Jual Tokped serum 3*\n` +
        `• Catat pengeluaran toko? Ketik:\n  *Beli [keterangan] [nominal]*\n  Contoh: *Beli lakban 30rb*\n\n` +
        `🧾 *KIRIM TAGIHAN (INVOICE)*\n` +
        `• Ketik: *Tagih [nominal] ke [nomor WA]*\n  Contoh: *Tagih 150rb ke 08123456789*\n\n` +
        `📦 *CEK GUDANG*\n` +
        `• *Stock list* ➡️ Lihat sisa semua barang\n` +
        `• *Masuk [SKU] [jumlah]* ➡️ Tambah stok barang datang\n` +
        `• *Keluar [SKU] [jumlah]* ➡️ Kurangi stok barang rusak/hilang\n\n` +
        `📋 *LAINNYA*\n` +
        `• *Laporan* — Rekap transaksi hari ini\n` +
        `• *Status* — Info & status akun\n` +
        `• *Paket* — Opsi upgrade & langganan\n\n` +
        `💡 *TIPS:* Angka bisa diketik bebas, contoh: *20rb*, *1.5jt*, *20000*.`
      );
    }

    await safeReply(msg,
      `Waduh, Tata agak bingung nih sama ketikannya 😅\n\n` +
      `Coba pakai cara simpel aja ya bos:\n\n` +
      `🟢 *Jual kopi 15rb* — ada yang beli\n` +
      `🔴 *Beli gula 20rb* — bos belanja\n` +
      `🧾 *Tagih 50rb ke 0812345...* — mau nagih\n\n` +
      `Atau ketik *Bantuan* untuk contekan lengkapnya.`
    );
      return;
    } catch (err: any) {
      const errMsg = sanitizeError(err);
      if (errMsg.includes('[SUPABASE ERROR]')) circuitRecordFailure();
      const errType = errMsg.includes('Database') || errMsg.includes('Gagal daftar') ? '[MESSAGE HANDLER ERROR: New User]' : '[MESSAGE HANDLER ERROR]';
      addLog('error', `${errType}: ${errMsg}`, { sender, body: body?.substring(0, 200) });
      await safeReply(msg, `Maaf ya, sistem Tata sedang sedikit sibuk 🙏\nMohon tunggu sebentar dan coba lagi ya!`);
    }
  });
}

export { handleMessage, invalidateMaintenanceCache };
