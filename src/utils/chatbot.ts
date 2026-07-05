import supabase from '../config/supabase';
import { addLog } from '../config/state';
import { processMessageWithGemini } from './geminiRouter';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const CONV_MODELS = [
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callOpenRouter(messages: ChatMessage[]): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  for (const model of CONV_MODELS) {
    try {
      const body = {
        model,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
      };
      const resp = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://localhost',
          'X-Title': 'Tata Business Suite',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        addLog('warn', `[CHATBOT] ${model} failed: ${resp.status} ${errBody.slice(0, 200)}`);
        continue;
      }

      const data: any = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content.trim();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('warn', `[CHATBOT] ${model} timeout`);
      } else {
        addLog('warn', `[CHATBOT] ${model} error: ${err.message}`);
      }
    }
  }

  clearTimeout(timeout);
  return null;
}

function buildSummary(products: any[], trans: any[], cashierSales: any[]): string {
  const lines: string[] = [];

  // ── Stok ──
  if (products.length) {
    const total = products.length;
    const low = products.filter((p: any) => parseFloat(p.stock_current) <= parseFloat(p.stock_min)).length;
    const habis = products.filter((p: any) => parseFloat(p.stock_current) <= 0).length;
    const totalValue = products.reduce(
      (s: number, p: any) => s + (parseFloat(p.stock_current) || 0) * (parseFloat(p.price_buy) || 0),
      0,
    );
    lines.push(`【 STOK 】`);
    lines.push(`Total produk: ${total}`);
    lines.push(`Stok habis: ${habis}`);
    lines.push(`Stok menipis: ${low}`);
    lines.push(`Nilai inventori: Rp ${totalValue.toLocaleString('id-ID')}`);
  } else {
    lines.push(`【 STOK 】\nBelum ada produk.`);
  }

  // ── Keuangan (30 hari) ──
  let omzet = 0,
    pengeluaran = 0,
    piutang = 0;
  trans.forEach((t: any) => {
    const v = Number(t.amount) || 0;
    if (t.type === 'masuk' && t.reference_type !== 'modal' && t.reference_type !== 'receivable') omzet += v;
    else if (t.type === 'keluar') pengeluaran += v;
    if (t.reference_type === 'receivable') piutang += t.type === 'masuk' ? v : -v;
  });
  let hpp = 0;
  (cashierSales || []).forEach((t: any) => {
    hpp += (Number(t.quantity) || 0) * (Number(t.price_buy) || 0);
  });
  const labaBersih = omzet - hpp - pengeluaran;
  const profitMargin = omzet > 0 ? (labaBersih / omzet) * 100 : 0;

  lines.push(``);
  lines.push(`【 KEUANGAN — 30 Hari Terakhir 】`);
  lines.push(`Omzet: Rp ${omzet.toLocaleString('id-ID')}`);
  lines.push(`HPP: Rp ${hpp.toLocaleString('id-ID')}`);
  lines.push(`Biaya operasional: Rp ${pengeluaran.toLocaleString('id-ID')}`);
  lines.push(
    `Laba bersih: Rp ${Math.abs(labaBersih).toLocaleString('id-ID')} (${labaBersih >= 0 ? 'UNTUNG' : 'DEFISIT'})`,
  );
  lines.push(`Margin laba: ${profitMargin.toFixed(1)}%`);
  lines.push(`Piutang beredar: Rp ${Math.max(0, piutang).toLocaleString('id-ID')}`);

  lines.push(``);
  lines.push(`【 PRODUK 】`);
  products.slice(0, 30).forEach((p: any) => {
    lines.push(`- ${p.name}: ${p.stock_current} ${p.unit || ''} (min: ${p.stock_min || 0})`);
  });
  if (products.length > 30) {
    lines.push(`... dan ${products.length - 30} produk lainnya`);
  }

  return lines.join('\n');
}

async function processMessage(userId: string, message: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return 'Maaf, AI assistant belum dikonfigurasi. Hubungi admin untuk mengatur OPENROUTER_API_KEY.';
  }

  let summary = '';
  try {
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const [prodResult, transResult, cashierResult] = await Promise.all([
      supabase
        .from('products')
        .select('name, stock_current, stock_min, unit, price_buy, category')
        .eq('user_id', userId) as any,
      supabase
        .from('transactions')
        .select('type, amount, reference_type')
        .eq('user_id', userId)
        .gte('created_at', since) as any,
      supabase
        .from('transactions')
        .select('price_buy, quantity')
        .eq('user_id', userId)
        .in('reference_type', ['cashier', 'stock_out'])
        .gte('created_at', since) as any,
    ]);

    const products = (prodResult as any).data || [];
    const trans = (transResult as any).data || [];
    const cashierSales = (cashierResult as any).data || [];

    summary = buildSummary(products, trans, cashierSales);
  } catch {
    summary = 'Data tidak tersedia saat ini.';
  }

  const systemPrompt = `Kamu adalah asisten stok dan keuangan untuk dashboard bisnis. Tugasmu membantu user mengelola stok, memahami laporan, dan memberi rekomendasi bisnis.

Berikut data bisnis user:
${summary}

Panduan menjawab:
- Jawab singkat, padat, dan praktis dalam Bahasa Indonesia.
- Gunakan paragraf pendek. Beri jarak antar paragraf (enter/spasi) agar mudah dibaca.
- Jika user bertanya untung/rugi, jawab berdasarkan data keuangan di atas. Sebutkan angka omzet, biaya, dan laba bersih.
- Jika user bertanya stok, sebutkan nama produk, jumlah, dan unit.
- Jika user minta rekomendasi, beri saran berdasarkan data yang tersedia.
- Jika data tidak cukup untuk menjawab, beri tahu dengan sopan dan tawarkan bantuan lain.
- Jangan gunakan markdown. Gunakan teks biasa dengan enter untuk pemisah.`;

  const result = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ]);

  if (result) return result;

  try {
    const classified = await processMessageWithGemini(message);
    if (classified && classified.intent === 'cek_stok') {
      return 'Silakan cek stok produk di halaman Produk.\n\n' + 'Atau ketik nama produk yang ingin ditanyakan.';
    }
    return 'Maaf, saya tidak bisa memproses pertanyaan Anda saat ini. Coba lagi nanti.';
  } catch {
    return 'Maaf, saya tidak bisa memproses pertanyaan Anda saat ini. Coba lagi nanti.';
  }
}

export { processMessage };
