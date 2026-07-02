import supabase from '../config/supabase';

function parseCurrency(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  let clean = text.toLowerCase().trim();

  if (/\d+(kg|gr|gram|ons|liter|lt|ml|cc|buah|biji|bungkus|pack|pcs|box|krat|karton|dus|sak|meter|cm|mm|menit|jam|hari|minggu|bulan|tahun|orang|org|lembar|rim|roll|set|pasang|ton)$/i.test(clean)) {
    return null;
  }

  clean = clean.replace(/^rp\.?\s*/i, '').replace(/^[:\s]+/, '').replace(/[:\s]+$/, '').trim();

  let multiplier = 1;

  if (/(?:m|miliar|milyar)$/.test(clean)) {
    multiplier = 1_000_000_000;
    clean = clean.replace(/(?:m|miliar|milyar)$/, '');
  } else if (/(?:jt|juta)(?:an)?$/.test(clean)) {
    multiplier = 1_000_000;
    clean = clean.replace(/(?:jt|juta)(?:an)?$/, '');
  } else if (/(?:rb|rbu|ribu|k)(?:an)?$/.test(clean)) {
    multiplier = 1_000;
    clean = clean.replace(/(?:rb|rbu|ribu|k)(?:an)?$/, '');
  }

  if (multiplier > 1) {
    clean = clean.replace(',', '.');
  } else {
    const dotCount = (clean.match(/\./g) || []).length;
    const commaCount = (clean.match(/,/g) || []).length;

    if (dotCount >= 2) {
      clean = clean.replace(/\./g, '');
    } else if (commaCount >= 2) {
      clean = clean.replace(/,/g, '');
    } else if (dotCount === 1 && commaCount === 0) {
      const parts = clean.split('.');
      if ((parts[1]?.length ?? 0) === 3 && /^\d+$/.test(parts[1])) {
        clean = clean.replace('.', '');
      }
    } else if (commaCount === 1 && dotCount === 0) {
      const parts = clean.split(',');
      if ((parts[1]?.length ?? 0) === 3 && /^\d+$/.test(parts[1])) {
        clean = clean.replace(',', '');
      } else {
        clean = clean.replace(',', '.');
      }
    } else if (dotCount > 0 && commaCount > 0) {
      if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(/\./g, '').replace(',', '.');
      }
    }
  }

  clean = clean.replace(/[^0-9.]/g, '');
  const nominal = parseFloat(clean) * multiplier;

  if (isNaN(nominal) || nominal <= 0 || nominal > 1_000_000_000_000) return null;
  return Math.round(nominal);
}

function parseQuantity(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  const match = clean.match(/^(\d+(?:[.,]\d+)?)(kg|gr|gram|liter|ml|buah|biji|bungkus|pack|pcs|box|dus|karton|sak|meter|cm|mm)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  if (isNaN(num) || num <= 0 || num > 1_000_000) return null;

  return num;
}

function formatPhone(sender: string): string {
  let n = sender.replace(/@.*$/, '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return '+' + n;
}

function formatRupiah(amount: number): string {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}

async function getDailyTransactionCount(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('transactions').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', start.toISOString()) as any;
  if (error) throw new Error(`DB count error: ${error.message}`);
  return count ?? 0;
}

interface UserInfo {
  status?: string;
  subscription_expires_at?: string;
  store_name?: string;
}

function getEffectiveStatus(user: UserInfo): string {
  if (user?.status === 'pro') {
    if (!user.subscription_expires_at || new Date(user.subscription_expires_at) <= new Date()) return 'demo';
  }
  return user?.status || 'demo';
}

function getDaysRemaining(user: UserInfo): number | null {
  if (!user.subscription_expires_at) return null;
  const diff = new Date(user.subscription_expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function buildStatusMessage(user: UserInfo, effectiveStatus: string, sender: string): string {
  let statusBlock = '';
  if (effectiveStatus === 'demo') {
    statusBlock = `\uD83C\uDFAF *Status:* \uD83C\uDD93 FREE DEMO\n\uD83D\uDCA1 Ketik *Paket* untuk upgrade.`;
  } else if (effectiveStatus === 'pro') {
    const sisa = getDaysRemaining(user);
    statusBlock = `\uD83C\uDFAF *Status:* \u2B50 PRO BULANAN\n\uD83D\uDCC5 *Masa Aktif:* Sisa ${sisa} hari lagi`;
  } else {
    statusBlock = `\uD83C\uDFAF *Status:* \uD83D\uDC8E UNLIMITED SELAMANYA`;
  }
  return `\u2139\uFE0F *INFO AKUN - ${(user.store_name || '').toUpperCase()}*\n\n` +
    `\uD83C\uDFEA *Toko:* ${user.store_name}\n` +
    `\uD83D\uDCF1 *WhatsApp:* ${formatPhone(sender)}\n\n---\n\n${statusBlock}\n\n---`;
}

export { parseCurrency, parseQuantity, formatPhone, formatRupiah, getDailyTransactionCount, getEffectiveStatus, getDaysRemaining, buildStatusMessage };
