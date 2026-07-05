import supabase from '../config/supabase';
import { addLog } from '../config/state';
import accountingEngine from './accountingEngine';
import { withTransaction } from './db';

interface RecordOpts {
  userId: string;
  type: string;
  amount: number;
  description?: string;
  productId?: string;
  quantity?: number;
  priceSell?: number;
  priceBuy?: number;
  profit?: number;
  channel?: string;
  referenceType?: string;
  hpp?: number;
  bebanOperasional?: number;
  customerName?: string;
  statusBayar?: string;
}

interface RecordSaleOpts {
  userId: string;
  productId: string;
  quantity: number;
  priceSell: number;
  priceBuy: number;
  totalOmzet?: number;
  channel?: string;
  description?: string;
  referenceType?: string;
}

interface ExpenseOpts {
  userId: string;
  amount: number;
  description?: string;
  bebanOperasional?: number;
  statusBayar?: string;
  customerName?: string;
}

interface DamagedGoodsOpts {
  userId: string;
  productId: string;
  quantity: number;
  priceBuy?: number;
  description?: string;
}

interface PembukuanOpts {
  userId: string;
  tipe: string;
  amount: number;
  description: string;
  customerName?: string;
  coaDebit?: string;
  coaCredit?: string;
  channel?: string;
}

interface RecordResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface ChannelConfig {
  name: string;
  coaCode: string;
  adminFeePct: number;
}

// ── Channel config cache (5 min TTL) ──
const channelCache = new Map<string, { data: ChannelConfig[]; ts: number }>();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000;

function invalidateChannelCache(userId: string): void {
  channelCache.delete(userId);
}

async function getChannelConfig(userId: string): Promise<ChannelConfig[]> {
  const cached = channelCache.get(userId);
  if (cached && Date.now() - cached.ts < CHANNEL_CACHE_TTL) {
    return cached.data;
  }
  const { data, error } = await supabase
    .from('sales_channels')
    .select('name, coa_code, admin_fee_pct')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error || !data) {
    addLog('error', '[TRX-RECORDER] getChannelConfig error: ' + (error?.message || 'no data'));
    return [];
  }
  const configs: ChannelConfig[] = (data as any[]).map((r: any) => ({
    name: r.name,
    coaCode: r.coa_code,
    adminFeePct: Number(r.admin_fee_pct) || 0,
  }));
  channelCache.set(userId, { data: configs, ts: Date.now() });
  return configs;
}

async function resolveChannel(userId: string, channel: string): Promise<{ coaCode: string; adminFeePct: number }> {
  const configs = await getChannelConfig(userId);
  const match = configs.find((c) => c.name.toLowerCase() === channel.toLowerCase());
  if (match) return { coaCode: match.coaCode, adminFeePct: match.adminFeePct };
  return { coaCode: '4101', adminFeePct: 0 };
}

// ── Cash balance locking helper ──
async function lockAndCheckCashBalance(client: any, userId: string, amount: number): Promise<void> {
  const acct = await client.query(
    `SELECT balance FROM chart_of_accounts WHERE user_id = $1 AND code = '1101' FOR UPDATE`,
    [userId]
  );
  if (acct.rows.length === 0) throw new Error('Akun Kas (1101) belum di-set. Hubungi admin.');
  const balance = parseFloat(acct.rows[0].balance) || 0;
  if (balance < amount) {
    throw new Error(`Saldo kas tidak cukup. Saldo: Rp ${balance.toLocaleString('id-ID')}`);
  }
}

async function recordTransaction(opts: RecordOpts): Promise<RecordResult> {
  const {
    userId, type, amount, description, productId, quantity,
    priceSell, priceBuy, profit, channel = 'Offline',
    referenceType = 'manual', hpp, bebanOperasional,
    customerName, statusBayar = 'tunai',
  } = opts;

  if (!userId) return { success: false, error: 'userId is required' };
  if (!type) return { success: false, error: 'type is required' };
  if (amount == null) return { success: false, error: 'amount is required' };

  const record: Record<string, unknown> = {
    user_id: userId,
    type,
    status_bayar: statusBayar,
    channel,
    amount,
    description: description || '',
    reference_type: referenceType,
  };

  if (productId) record.product_id = productId;
  if (quantity != null) record.quantity = quantity;
  if (priceSell != null) record.price_sell = priceSell;
  if (priceBuy != null) record.price_buy = priceBuy;
  if (profit != null) record.profit = profit;
  if (hpp != null) record.hpp = hpp;
  if (bebanOperasional != null) record.beban_operasional = bebanOperasional;
  if (customerName) record.customer_name = customerName;

  const { data, error } = await supabase
    .from('transactions')
    .insert([record])
    .select()
    .single();

  if (error) {
    addLog('error', '[TRX-RECORDER] insert error: ' + error.message);
    return { success: false, error: `Gagal simpan transaksi: ${error.message}` };
  }

  return { success: true, data };
}

async function recordSale(opts: RecordSaleOpts): Promise<RecordResult> {
  const {
    userId, productId, quantity, priceSell, priceBuy,
    totalOmzet, channel = 'Offline', description,
    referenceType = 'cashier',
  } = opts;

  if (!userId) return { success: false, error: 'userId is required' };
  if (!productId) return { success: false, error: 'productId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };

  const qty = parseFloat(String(quantity));
  const sell = parseFloat(String(priceSell)) || 0;
  const buy = parseFloat(String(priceBuy)) || 0;
  const omzet = totalOmzet || (qty * sell);
  const modal = qty * buy;
  const profit = omzet - modal;

  try {
    return await withTransaction(async (client) => {
      // 0. Resolve channel config
      const ch = await resolveChannel(userId, channel);
      const bebanAdmin = omzet * (ch.adminFeePct / 100);
      const danaBersih = omzet - bebanAdmin;

      // 1. Lock product row + read current stock
      const prod = await client.query(
        `SELECT stock_current, stock_min, unit FROM products
         WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId]
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const stockBefore = parseFloat(prod.rows[0].stock_current) || 0;
      if (stockBefore < qty) {
        throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore}`);
      }

      // 2. Update stock
      const stockAfter = stockBefore - qty;
      await client.query(
        `UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`,
        [stockAfter, productId, userId]
      );

      // 3. Insert stock_movements
      await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity,
         stock_before, stock_after, reference_type, created_via)
         VALUES ($1, $2, 'out', $3, $4, $5, 'cashier', 'system')`,
        [userId, productId, qty, stockBefore, stockAfter]
      );

      // 4. Insert transaction
      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel,
         amount, description, reference_type, product_id, quantity,
         price_sell, price_buy, profit, hpp)
         VALUES ($1, 'masuk', 'tunai', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [userId, channel, omzet, description || `Penjualan ${qty} item`,
         referenceType, productId, qty, sell, buy, profit, modal]
      );
      const trxId = trx.rows[0].id;

      // 5. Build journal lines
      const revenueLines: Array<{ accountCode: string; debit: number; credit: number; description?: string }> = [];
      if (bebanAdmin > 0) {
        revenueLines.push(
          { accountCode: '1101', debit: danaBersih, credit: 0, description: 'Penerimaan penjualan (bersih)' },
          { accountCode: '6105', debit: bebanAdmin, credit: 0, description: `Beban admin ${channel} ${ch.adminFeePct}%` },
          { accountCode: ch.coaCode, debit: 0, credit: omzet, description: `Penjualan via ${channel}` },
        );
      } else {
        revenueLines.push(
          { accountCode: '1101', debit: omzet, credit: 0, description: 'Penerimaan penjualan' },
          { accountCode: ch.coaCode, debit: 0, credit: omzet, description: `Penjualan via ${channel}` },
        );
      }

      const allLines = [
        ...revenueLines,
        { accountCode: '5101', debit: modal, credit: 0, description: `HPP ${qty} item` },
        { accountCode: '1201', debit: 0, credit: modal, description: 'Pengurangan inventori' },
      ];

      const journalId = await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'sale',
        referenceId: String(trxId),
        description: description || `Penjualan ${qty} item via ${channel}`,
        lines: allLines,
      });

      return {
        success: true,
        data: {
          transaction: { id: trxId },
          stockBefore,
          stockAfter,
          totalOmzet: omzet,
          bebanAdmin,
          danaBersih,
          totalModal: modal,
          profit: danaBersih - modal - bebanAdmin,
        },
      };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordSale failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function recordExpense(opts: ExpenseOpts): Promise<RecordResult> {
  const { userId, amount, description, bebanOperasional, statusBayar, customerName } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!amount || amount <= 0) return { success: false, error: 'amount must be > 0' };

  try {
    return await withTransaction(async (client) => {
      // Lock cash balance before deducting
      await lockAndCheckCashBalance(client, userId, amount);

      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, reference_type, customer_name, beban_operasional)
         VALUES ($1, 'keluar', $2, 'Offline', $3, $4, 'manual', $5, $6)
         RETURNING id`,
        [userId, statusBayar || 'tunai', amount, description || 'Pengeluaran', customerName || null, bebanOperasional || amount]
      );
      const trxId = trx.rows[0].id;

      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'expense',
        referenceId: String(trxId),
        description: description || 'Pengeluaran',
        lines: [
          { accountCode: '6105', debit: amount, credit: 0, description: description || 'Beban operasional' },
          { accountCode: '1101', debit: 0, credit: amount, description: 'Pembayaran beban' },
        ],
      });

      return { success: true, data: { id: trxId } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordExpense failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function recordDamagedGoods(opts: DamagedGoodsOpts): Promise<RecordResult> {
  const { userId, productId, quantity, priceBuy, description } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!productId) return { success: false, error: 'productId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };

  const qty = parseFloat(String(quantity)) || 0;
  const buy = parseFloat(String(priceBuy)) || 0;
  const loss = qty * buy;

  try {
    return await withTransaction(async (client) => {
      const prod = await client.query(
        `SELECT stock_current FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId]
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const stockBefore = parseFloat(prod.rows[0].stock_current) || 0;
      if (stockBefore < qty) {
        throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore}`);
      }

      const stockAfter = stockBefore - qty;
      await client.query(
        `UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`,
        [stockAfter, productId, userId]
      );

      await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, created_via)
         VALUES ($1, $2, 'out', $3, $4, $5, 'damaged', 'system')`,
        [userId, productId, qty, stockBefore, stockAfter]
      );

      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, reference_type, product_id, quantity, price_buy, beban_operasional)
         VALUES ($1, 'barang_rusak', 'tunai', 'Offline', 0, $2, 'manual', $3, $4, $5, $6)
         RETURNING id`,
        [userId, description || `Barang rusak/susut ${qty} item`, productId, qty, buy, loss]
      );
      const trxId = trx.rows[0].id;

      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'damaged_goods',
        referenceId: String(trxId),
        description: description || `Barang rusak ${qty} item`,
        lines: [
          { accountCode: '6105', debit: loss, credit: 0, description: 'Kerugian barang rusak' },
          { accountCode: '1201', debit: 0, credit: loss, description: 'Pengurangan inventori rusak' },
        ],
      });

      return { success: true, data: { id: trxId } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordDamagedGoods failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

const PEMBUKUAN_COA_MAP: Record<string, { debit: string; credit: string; label: string }> = {
  beban_gaji:        { debit: '6101', credit: '1101', label: 'Beban Gaji' },
  beban_sewa:        { debit: '6102', credit: '1101', label: 'Beban Sewa' },
  beban_listrik_air: { debit: '6103', credit: '1101', label: 'Beban Listrik & Air' },
  beban_transport:   { debit: '6104', credit: '1101', label: 'Beban Transport' },
  beban_operasional: { debit: '6105', credit: '1101', label: 'Beban Operasional Lainnya' },
  modal:             { debit: '1101', credit: '3101', label: 'Modal Pemilik' },
  prive:             { debit: '3102', credit: '1101', label: 'Prive' },
  piutang:           { debit: '1102', credit: '4101', label: 'Piutang Dagang' },
  hutang_dagang:     { debit: '1201', credit: '2101', label: 'Hutang Dagang' },
  hutang_lancar:     { debit: '6105', credit: '2101', label: 'Hutang Lancar' },
};

async function recordPembukuan(opts: PembukuanOpts): Promise<RecordResult> {
  const { userId, tipe, amount, description, customerName, coaDebit, coaCredit, channel } = opts;

  if (!userId) return { success: false, error: 'userId is required' };
  if (!tipe) return { success: false, error: 'tipe is required' };
  if (!amount || amount <= 0) return { success: false, error: 'amount must be > 0' };
  if (!description || !description.trim()) return { success: false, error: 'description is required' };

  const coaMap = PEMBUKUAN_COA_MAP[tipe];
  if (!coaMap && !coaDebit && !coaCredit) {
    return { success: false, error: `Tipe "${tipe}" tidak dikenal. Gunakan override coaDebit/coaCredit` };
  }

  const debitCode = coaDebit || coaMap.debit;
  const creditCode = coaCredit || coaMap.credit;

  // Override credit account for piutang based on sales channel
  const effectiveCredit = (tipe === 'piutang' && channel) ? (await resolveChannel(userId, channel)).coaCode : creditCode;

  if (['piutang', 'hutang_dagang', 'hutang_lancar'].includes(tipe) && !customerName) {
    return { success: false, error: 'customerName is required for piutang/hutang' };
  }

  const lines = [
    { accountCode: debitCode, debit: Number(amount), credit: 0, description: coaMap ? coaMap.label : tipe },
    { accountCode: effectiveCredit, debit: 0, credit: Number(amount), description: `Pembayaran ${coaMap ? coaMap.label : tipe}` },
  ];

  // Hutang dagang/lancar: journal only (no cash transaction)
  if (tipe === 'hutang_dagang' || tipe === 'hutang_lancar') {
    try {
      return await withTransaction(async (client) => {
        const jr = await accountingEngine.insertJournalViaClient(client, userId, {
          entryDate: new Date(),
          referenceType: 'pembukuan',
          description: `${coaMap ? coaMap.label : tipe}: ${description}`,
          lines,
        });
        return { success: true, data: { journalId: jr.journalId } };
      });
    } catch (err: any) {
      return { success: false, error: `Jurnal gagal: ${err.message}` };
    }
  }

  const trxType = tipe.startsWith('beban') || tipe === 'prive' ? 'keluar'
    : (tipe === 'modal' || tipe === 'piutang') ? 'masuk'
    : 'keluar';

  const trxRefType = tipe === 'modal' ? 'modal'
    : tipe === 'piutang' ? 'receivable'
    : 'pembukuan';

  const trxDesc = customerName && tipe === 'piutang'
    ? `${description} (Customer: ${customerName})`
    : customerName
      ? `${description} — ${customerName}`
      : description;

  try {
    return await withTransaction(async (client) => {
      // Lock cash for types that deduct from cash
      if (tipe.startsWith('beban') || tipe === 'prive') {
        await lockAndCheckCashBalance(client, userId, Number(amount));
      }

      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, reference_type, customer_name)
         VALUES ($1, $2, 'tunai', $3, $4, $5, $6, $7)
         RETURNING id`,
        [userId, trxType, channel || 'Offline', Number(amount), trxDesc, trxRefType, customerName || null]
      );
      const trxId = trx.rows[0].id;

      const jr = await accountingEngine.insertJournalViaClient(client, userId, {
        entryDate: new Date(),
        referenceType: 'pembukuan',
        referenceId: String(trxId),
        description: `${coaMap ? coaMap.label : tipe}: ${description}`,
        lines,
      });

      return { success: true, data: { transaction: { id: trxId }, journalId: jr.journalId } };
    });
  } catch (err: any) {
    return { success: false, error: `Pembukuan gagal: ${err.message}` };
  }
}

async function recordTransactionWithJournal(
  userId: string, type: string, amount: number,
  description: string, productId?: string, demoCheck?: boolean
): Promise<RecordResult> {
  if (!userId) return { success: false, error: 'userId is required' };
  if (!type) return { success: false, error: 'type is required' };
  if (amount == null) return { success: false, error: 'amount is required' };

  try {
    return await withTransaction(async (client) => {
      // Demo limit: serialized via advisory lock to prevent race
      if (demoCheck) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [userId]);
        const countRes = await client.query(
          `SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
          [userId]
        );
        if (parseInt(countRes.rows[0].cnt, 10) >= 5) {
          throw new Error('Limit harian demo habis');
        }
      }

      // Lock cash balance for expenses
      if (type === 'keluar') {
        await lockAndCheckCashBalance(client, userId, amount);
      }

      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, product_id, reference_type)
         VALUES ($1, $2, 'tunai', 'Offline', $3, $4, $5, 'manual')
         RETURNING id`,
        [userId, type, amount, description || '', productId || null]
      );
      const trxId = trx.rows[0].id;

      if (type === 'masuk') {
        await accountingEngine.insertJournalViaClient(client, userId, {
          referenceType: 'manual',
          referenceId: String(trxId),
          description: description || 'Pemasukan',
          lines: [
            { accountCode: '1101', debit: amount, credit: 0, description: 'Penerimaan' },
            { accountCode: '4101', debit: 0, credit: amount, description: 'Pendapatan' },
          ],
        });
      } else if (type === 'keluar') {
        await accountingEngine.insertJournalViaClient(client, userId, {
          referenceType: 'manual',
          referenceId: String(trxId),
          description: description || 'Pengeluaran',
          lines: [
            { accountCode: '6105', debit: amount, credit: 0, description: 'Beban operasional' },
            { accountCode: '1101', debit: 0, credit: amount, description: 'Pembayaran' },
          ],
        });
      }

      return { success: true, data: { id: trxId } };
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function recordStockAdjustment(opts: {
  userId: string;
  productId: string;
  type: 'in' | 'out';
  quantity: number;
  note?: string;
  unitPrice?: number;
  channel?: string;
}): Promise<RecordResult> {
  const { userId, productId, type, quantity, note, unitPrice, channel = 'Offline' } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!productId) return { success: false, error: 'productId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };
  if (!['in', 'out'].includes(type)) return { success: false, error: 'type must be in or out' };
  try {
    return await withTransaction(async (client) => {
      const prod = await client.query(
        `SELECT id, name, stock_current, stock_min, unit, price_buy, price_sell FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId]
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const p = prod.rows[0];
      const stockBefore = parseFloat(p.stock_current) || 0;
      const stockAfter = type === 'in' ? stockBefore + quantity : stockBefore - quantity;
      if (stockAfter < 0) throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore} ${p.unit}`);
      await client.query(
        `UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`,
        [stockAfter, productId, userId]
      );
      const mov = await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_via)
         VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, 'whatsapp')
         RETURNING id`,
        [userId, productId, type, quantity, stockBefore, stockAfter, note || null]
      );
      const movId = mov.rows[0].id;
      if (type === 'in') {
        const buyPrice = unitPrice || parseFloat(p.price_buy) || 0;
        const totalValue = quantity * buyPrice;
        if (unitPrice || parseFloat(p.price_buy) > 0) {
          await client.query(`UPDATE stock_movements SET unit_price = $1, total_value = $2 WHERE id = $3`, [buyPrice, totalValue, movId]);
        }
        if (totalValue > 0) {
          await accountingEngine.insertJournalViaClient(client, userId, {
            referenceType: 'stock_in', referenceId: String(movId),
            description: `Stok Masuk ${quantity} ${p.unit}: ${p.name}`,
            lines: [
              { accountCode: '1201', debit: totalValue, credit: 0, description: 'Penambahan inventori' },
              { accountCode: '3101', debit: 0, credit: totalValue, description: 'Modal inventori' },
            ],
          });
        }
      } else {
        const ch = await resolveChannel(userId, channel);
        const sellPrice = parseFloat(p.price_sell) || 0;
        const buyPrice = parseFloat(p.price_buy) || 0;
        const omzet = quantity * sellPrice;
        const modal = quantity * buyPrice;
        const bebanAdmin = omzet * (ch.adminFeePct / 100);
        const danaBersih = omzet - bebanAdmin;

        if (sellPrice > 0) {
          await client.query(`UPDATE stock_movements SET unit_price = $1, total_value = $2 WHERE id = $3`, [sellPrice, omzet, movId]);
        }
        if (modal > 0) {
          const lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }> = [];
          if (bebanAdmin > 0) {
            lines.push(
              { accountCode: '1101', debit: danaBersih, credit: 0, description: 'Penerimaan penjualan (bersih)' },
              { accountCode: '6105', debit: bebanAdmin, credit: 0, description: `Beban admin ${channel} ${ch.adminFeePct}%` },
              { accountCode: ch.coaCode, debit: 0, credit: omzet, description: `Penjualan via ${channel}` },
            );
          } else {
            lines.push(
              { accountCode: '1101', debit: omzet, credit: 0, description: 'Penerimaan penjualan' },
              { accountCode: ch.coaCode, debit: 0, credit: omzet, description: `Penjualan via ${channel}` },
            );
          }
          lines.push(
            { accountCode: '5101', debit: modal, credit: 0, description: `HPP ${quantity} item` },
            { accountCode: '1201', debit: 0, credit: modal, description: 'Pengurangan inventori' },
          );
          await accountingEngine.insertJournalViaClient(client, userId, {
            referenceType: 'stock_out', referenceId: String(movId),
            description: `Penjualan ${quantity} ${p.unit}: ${p.name}`,
            lines,
          });
        }
      }
      return { success: true, data: { stockBefore, stockAfter, product: { name: p.name, unit: p.unit } } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordStockAdjustment failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

export {
  recordTransaction,
  recordTransactionWithJournal,
  recordSale,
  recordExpense,
  recordDamagedGoods,
  recordPembukuan,
  recordStockAdjustment,
  PEMBUKUAN_COA_MAP,
  invalidateChannelCache,
};
