import { MessageMedia } from 'whatsapp-web.js';
import supabase from '../config/supabase';
import { addLog } from '../config/state';
import { safeReply, sanitizeError } from '../config/message-state';
import { formatRupiah, parseCurrency } from '../utils/helpers';
import type { Message, Client } from 'whatsapp-web.js';

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `TBS-${y}${m}${d}-${rand}`;
}

function normalizeWaNumber(raw: string): string {
  let num = raw.replace(/[^0-9]/g, '');
  if (num.startsWith('0')) num = '62' + num.slice(1);
  else if (num.startsWith('8') && !num.startsWith('62')) num = '62' + num;
  return num;
}

interface CacheEntry<T> {
  val: T;
  exp: number;
}

const _bankCache = new Map<string, CacheEntry<{ name: string; account: string; holder: string }>>();

function getBankCache(userId: string): { name: string; account: string; holder: string } | null {
  const e = _bankCache.get(userId);
  if (!e) return null;
  if (Date.now() > e.exp) { _bankCache.delete(userId); return null; }
  return e.val;
}

function setBankCache(userId: string, bankInfo: { name: string; account: string; holder: string }): void {
  _bankCache.set(userId, { val: bankInfo, exp: Date.now() + 10 * 60 * 1000 });
  if (_bankCache.size > 200) {
    const oldest = _bankCache.keys().next().value;
    if (oldest) _bankCache.delete(oldest);
  }
}

interface InvoiceData {
  invoiceNumber: string;
  storeName: string;
  targetNumber: string;
  amount: number;
  dateStr: string;
  dueDateStr: string;
  bank: { name: string; account: string; holder: string };
}

async function generateInvoicePDF(invoiceData: InvoiceData): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  let PDFDocument: any;
  try { PDFDocument = require('pdfkit'); }
  catch { return { success: false, error: 'pdfkit tidak terinstall.' }; }

  const { invoiceNumber, storeName, targetNumber, amount, dateStr, dueDateStr, bank } = invoiceData;

  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve({ success: true, buffer: Buffer.concat(chunks) }));
      doc.on('error', (err: Error) => resolve({ success: false, error: err.message }));

      doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica')
        .fillColor('#666666')
        .text(`No: ${invoiceNumber}`, { align: 'right' });
      doc.moveDown(1.5);

      doc.fillColor('#000000');
      doc.fontSize(10).font('Helvetica-Bold').text('Dari:');
      doc.font('Helvetica').text(storeName);
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Kepada:');
      doc.font('Helvetica').text(`+${targetNumber}`);
      doc.moveDown(1);

      doc.font('Helvetica-Bold').text('Tanggal    : ').font('Helvetica').text(dateStr, { continued: false });
      doc.font('Helvetica-Bold').text('Jatuh Tempo: ').font('Helvetica').text(dueDateStr, { continued: false });
      doc.moveDown(1.5);

      const boxY = doc.y;
      doc.rect(50, boxY, 495, 60).stroke('#333333');
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
        .text('TOTAL TAGIHAN', 60, boxY + 8);
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#000000')
        .text(`Rp ${Number(amount).toLocaleString('id-ID')}`, 60, boxY + 26);
      doc.moveDown(3);

      doc.fontSize(12).font('Helvetica-Bold')
        .text('Instruksi Pembayaran');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .text(`Bank      : ${bank.name}`)
        .text(`No. Rek   : ${bank.account}`)
        .text(`Atas Nama : ${bank.holder}`);
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#666666')
        .text('Mohon transfer tepat waktu. Jika sudah transfer, konfirmasi ke pengirim invoice.');
      doc.moveDown(2);

      doc.fontSize(8).fillColor('#999999')
        .text('Dikirim otomatis oleh Tata Business Suite', 50, 750, { align: 'center' });

      doc.end();
    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
}

async function handleSetBankCommand(msg: Message, sender: string, user: any, rawBody: string): Promise<boolean> {
  const parts = rawBody.split(/\s+/);
  if (parts.length < 4) {
    await safeReply(msg, `❓ *Format SetBank Salah*\n\n` +
      `Format: *setbank [nama_bank] [no_rek] [nama_pemilik]*\n\n` +
      `Contoh:\n` +
      `• *setbank BCA 8670662536 Ridwan*\n` +
      `• *setbank BRI 1234567890 Budi*\n` +
      `• *setbank Mandiri 0012345678 Siti*`
    );
    return true;
  }

  const bankName = parts[1];
  const bankAccount = parts[2];
  const bankHolder = parts.slice(3).join(' ');
  const bankData = { name: bankName, account: bankAccount, holder: bankHolder };

  let saved = false;
  let saveError: string | null = null;

  try {
    const { error: rpcErr } = await supabase.rpc('upsert_user_profile', {
      p_user_id: sender, p_bank_name: bankName,
      p_bank_account: bankAccount, p_bank_holder: bankHolder,
    }) as any;
    if (!rpcErr) saved = true;
  } catch { /* ignore */ }

  if (!saved) {
    try {
      const { error: upsertErr } = await supabase
        .from('users').update({ bank_name: bankName, bank_account: bankAccount, bank_holder: bankHolder })
        .eq('id', sender) as any;
      if (!upsertErr) saved = true;
      else saveError = upsertErr.message;
    } catch (e: any) { saveError = e.message; }
  }

  setBankCache(sender, bankData);

  if (!saved) {
    addLog('warn', '[SETBANK] DB save failed but cache set: ' + sanitizeError(saveError));
    await safeReply(msg, `✅ Tata sudah catat data bank kamu untuk sesi ini.\n\n` +
      `🏦 Bank     : *${bankName}*\n` +
      `💳 No. Rek  : *${bankAccount}*\n` +
      `👤 Atas Nama: *${bankHolder}*\n\n` +
      `Kamu sudah bisa langsung kirim tagihan ya! 😊\n` +
      `_Catatan: Data belum tersimpan permanen. Coba lagi nanti jika server sudah stabil._`
    );
    return true;
  }

  await safeReply(msg, `✅ Siap! Tata sudah berhasil memperbarui data rekening bank kamu.\n\n` +
    `🏦 Bank     : *${bankName}*\n` +
    `💳 No. Rek  : *${bankAccount}*\n` +
    `👤 Atas Nama: *${bankHolder}*\n\n` +
    `Data kamu aman bersama Tata! 🔒\n` +
    `Kamu sudah bisa langsung kirim tagihan ya! 😊`
  );
  return true;
}

async function handleInvoiceCommand(msg: Message, sender: string, user: any, rawBody: string, client: Client): Promise<boolean> {
  const phoneMatch = rawBody.match(/(?:ke|kepada|nomer|nomor|wa)?\s*((?:\+?62|0)8\d[\d\s\-]{6,12}|8\d[\d\s\-]{7,12})/i);

  let amountText: string | null = null;
  if (phoneMatch) {
    const textBeforePhone = rawBody.substring(0, phoneMatch.index);
    const amountMatch = textBeforePhone.match(/(\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta|m|miliar|milyar))/i);
    if (amountMatch) amountText = amountMatch[1];
  }
  if (!amountText) {
    const fallbackMatch = rawBody.match(/(\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta|m|miliar|milyar))/i);
    if (fallbackMatch) amountText = fallbackMatch[1];
  }

  if (!amountText || !phoneMatch) {
    await safeReply(msg, `❌ *Format Tagihan Salah*\n\n` +
      `Format: *tagih [nominal] ke [nomor]*\n\n` +
      `Contoh:\n` +
      `• *tagih 150rb ke 08123456789*\n` +
      `• *tagih 1.5jt ke +628123456789*\n` +
      `• *tagih 500rb ke 08123456789*\n\n` +
      `💡 Format angka: 50rb • 1jt • 500k • 1.5jt`
    );
    return true;
  }

  let hasBank = false;
  let bankInfo: { name: string; account: string; holder: string } | null = null;

  const cachedBank = getBankCache(sender);
  if (cachedBank) {
    hasBank = true;
    bankInfo = cachedBank;
  }

  if (!hasBank) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('bank_name, bank_account, bank_holder')
        .eq('user_id', sender).maybeSingle() as any;
      if (profile?.bank_name) {
        hasBank = true;
        bankInfo = { name: profile.bank_name, account: profile.bank_account, holder: profile.bank_holder };
        setBankCache(sender, bankInfo);
      }
    } catch { /* ignore */ }
  }

  if (!hasBank) {
    try {
      const { data: u } = await supabase
        .from('users').select('bank_name, bank_account, bank_holder')
        .eq('id', sender).maybeSingle() as any;
      if (u?.bank_name) {
        hasBank = true;
        bankInfo = { name: u.bank_name, account: u.bank_account, holder: u.bank_holder };
        setBankCache(sender, bankInfo);
      }
    } catch { /* ignore */ }
  }

  if (!hasBank) {
    await safeReply(msg, `Halo Bosku! 👋 Sebelum kita kirim tagihan yang keren ke pelanggan, yuk atur rekening penerimanya dulu biar mereka gampang transfernya.\n\n` +
      `Ketik aja pakai format ini ya:\n` +
      `*setbank [Nama Bank] [No Rekening] [Atas Nama]*\n\n` +
      `Contoh: *setbank BCA 8670123456 Hanan*\n\n` +
      `Kalau udah, nanti tinggal ketik ulang perintah tagihnya. Yuk dicoba!`
    );
    return true;
  }

  const amount = parseCurrency(amountText);
  if (!amount) {
    await safeReply(msg, `❌ Nominal tidak valid.\n\nContoh: *tagih 150rb ke 08123456789*\nAtau ketik natural: *kirim tagihan 150rb ke 08123456789*`);
    return true;
  }

  const targetRaw = phoneMatch[1].trim();
  const targetNum = normalizeWaNumber(targetRaw);
  if (targetNum.length < 10 || targetNum.length > 15) {
    await safeReply(msg, `❌ Nomor telepon tidak valid: "${targetRaw}"\n\nContoh: *tagih 150rb ke 08123456789*`);
    return true;
  }

  const targetWa = `${targetNum}@c.us`;
  const invoiceNumber = generateInvoiceNumber();
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } as any);
  const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueDateStr = dueDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } as any);

  const invoiceText = [
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `🧾 *INVOICE / TAGIHAN*`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `No. Invoice : *${invoiceNumber}*`,
    `Tanggal     : ${dateStr}`,
    `Jatuh Tempo : ${dueDateStr}`,
    ``,
    `Dari        : *${user.store_name}*`,
    `Kepada      : ${targetNum}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *TOTAL TAGIHAN*`,
    ``,
    `   ${formatRupiah(amount)}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 *Instruksi Pembayaran*`,
    ``,
    `Transfer ke rekening berikut:`,
    ``,
    `🏦 Bank     : *${bankInfo!.name}*`,
    `💳 No. Rek  : *${bankInfo!.account}*`,
    `👤 Atas Nama: *${bankInfo!.holder}*`,
    ``,
    `Mohon transfer tepat waktu.`,
    `Jika sudah transfer, silakan`,
    `konfirmasi ke pengirim invoice.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Dikirim otomatis oleh_`,
    `*Tata Business Suite*`,
  ].join('\n');

  let pdfBuffer: Buffer | null = null;
  try {
    const pdfResult = await generateInvoicePDF({
      invoiceNumber, storeName: user.store_name, targetNumber: targetNum,
      amount, dateStr, dueDateStr, bank: bankInfo!,
    });
    if (pdfResult.success && pdfResult.buffer) pdfBuffer = pdfResult.buffer;
  } catch (pdfErr: any) {
    addLog('error', '[INVOICE] PDF generation failed: ' + pdfErr.message);
  }

  try {
    if (pdfBuffer) {
      const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), `Invoice-${invoiceNumber}.pdf`);
      await client.sendMessage(targetWa, media, { caption: invoiceText });
    } else {
      await client.sendMessage(targetWa, invoiceText);
    }
  } catch (sendErr: any) {
    await safeReply(msg, `❌ *Gagal mengirim tagihan*\n\n` +
      `Nomor *${targetNum}* tidak bisa dikirim.\n` +
      `Kemungkinan:\n` +
      `• Nomor tidak terdaftar di WhatsApp\n` +
      `• Tata belum menyimpan kontak tersebut\n\n` +
      `Error: ${sendErr.message}`
    );
    return true;
  }

  (supabase.from('invoices').insert([{
    user_id: sender, invoice_number: invoiceNumber,
    target_number: targetNum, amount, description: rawBody, status: 'sent',
  }] as any) as unknown as Promise<any>).then(async (invResult: any) => {
    if (invResult.error) return;
    try {
      await supabase.from('debts').insert([{
        user_id: sender, transaction_id: null, nama_pelanggan: targetNum,
        nominal_piutang: amount, status_lunas: false, jatuh_tempo: dueDate.toISOString(),
      }] as any);
    } catch { /* ignore */ }
  }).catch(() => {});

  await safeReply(msg,
    `✅ *Tagihan Terkirim!*\n\n` +
    `🧾 No. Invoice: *${invoiceNumber}*\n` +
    `💰 Nominal   : *${formatRupiah(amount)}*\n` +
    `📱 Dikirim ke: *${targetNum}*\n` +
    `📅 Jatuh Tempo: *${dueDateStr}*\n\n` +
    `Tagihan sudah masuk ke WhatsApp pelanggan.`
  );
  return true;
}

export {
  generateInvoiceNumber, normalizeWaNumber,
  getBankCache, setBankCache,
  generateInvoicePDF,
  handleSetBankCommand, handleInvoiceCommand,
};
