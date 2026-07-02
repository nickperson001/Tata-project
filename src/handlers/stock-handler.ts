import * as stockManager from '../utils/stockManager';
import { formatRupiah } from '../utils/helpers';
import { safeReply } from '../config/message-state';
import type { Message } from 'whatsapp-web.js';

async function handleStockList(msg: Message, user: any): Promise<boolean> {
  const result = await stockManager.listProducts(user.id, { active: true });

  if (!result.success) {
    await safeReply(msg, `❌ ${result.error}`);
    return true;
  }

  if (!result.products || result.products.length === 0) {
    await safeReply(msg, `📦 *Stock Kosong*\n\n` +
      `Belum ada produk terdaftar.\n\n` +
      `Tambah produk dengan:\n` +
      `*Tambah produk [SKU] [Nama] ...*\n\n` +
      `Ketik *Bantuan Stock* untuk panduan Tata.`
    );
    return true;
  }

  let text = `📦 *Daftar Produk - ${user.store_name}*\n\n`;

  (result.products as any[]).forEach((p: any, i: number) => {
    const stock = stockManager.formatQty(p.stock_current, p.unit);
    const alert = parseFloat(p.stock_current) <= parseFloat(p.stock_min) ? ' ⚠️' : '';

    text += `${i + 1}. *${p.name}*${alert}\n`;
    text += `   SKU: ${p.sku} | ${stock} ${p.unit}\n`;
    text += `   Jual: ${formatRupiah(p.price_sell)}\n\n`;
  });

  text += `Ketik *Stock info [SKU]* untuk detail produk.\nKetik *Dashboard* untuk kelola stok via web (tambah/kurang/opname).`;

  await safeReply(msg, text);
  return true;
}

async function handleStockInfo(msg: Message, user: any, rawBody: string): Promise<boolean> {
  const parts = rawBody.split(/\s+/);
  const skuOrId = parts[2];

  if (!skuOrId) {
    await safeReply(msg, `❌ Format: *Stock info [SKU]*\n\nContoh: Stock info BRS-01`);
    return true;
  }

  const result = await stockManager.getProduct(user.id, skuOrId);

  if (!result.success) {
    await safeReply(msg, `❌ Produk "${skuOrId}" tidak ditemukan.\n\nKetik *Stock list* untuk lihat semua produk.`);
    return true;
  }

  const p = result.product as any;
  const stock = stockManager.formatQty(p.stock_current, p.unit);
  const min = stockManager.formatQty(p.stock_min, p.unit);
  const value = parseFloat(p.stock_current) * parseFloat(p.price_buy);

  let alert = '';
  if (parseFloat(p.stock_current) <= 0) {
    alert = '\n\n🔴 *STOCK HABIS!*';
  } else if (parseFloat(p.stock_current) <= parseFloat(p.stock_min)) {
    alert = '\n\n⚠️ *Stock di bawah minimum!*';
  }

  await safeReply(msg,
    `📦 *Detail Produk*\n\n` +
    `SKU      : ${p.sku}\n` +
    `Nama     : ${p.name}\n` +
    `Kategori : ${p.category}\n` +
    `Satuan   : ${p.unit}\n\n` +
    `💵 Harga Beli : ${formatRupiah(p.price_buy)}\n` +
    `💰 Harga Jual : ${formatRupiah(p.price_sell)}\n\n` +
    `📊 Stock      : ${stock} ${p.unit}\n` +
    `⚠️ Minimum    : ${min} ${p.unit}\n` +
    `💎 Nilai Stock: ${formatRupiah(value)}` +
    alert + `\n\n` +
    `💡 Kelola stok (tambah/kurangi/opname) via web:\n` +
    `Ketik *Dashboard* untuk dapat link akses.`
  );
  return true;
}

async function handleStockReport(msg: Message, user: any): Promise<boolean> {
  const result = await stockManager.generateStockReport(user.id);

  if (!result.success) {
    await safeReply(msg, `❌ ${result.error}`);
    return true;
  }

  if ((result as any).totalProducts === 0) {
    await safeReply(msg, `📦 Belum ada produk terdaftar.`);
    return true;
  }

  let text = `📊 *Laporan Stock - ${user.store_name}*\n\n`;
  text += `Total Produk: ${(result as any).totalProducts}\n`;
  text += `Nilai Stock : ${formatRupiah((result as any).totalValue)}\n\n`;

  text += `*Per Kategori:*\n`;
  Object.entries((result as any).byCategory || {}).forEach(([cat, data]: [string, any]) => {
    text += `\n${cat} (${data.count} item)\n`;
    text += `Nilai: ${formatRupiah(data.value)}\n`;
  });

  await safeReply(msg, text);
  return true;
}

export { handleStockList, handleStockInfo, handleStockReport };
