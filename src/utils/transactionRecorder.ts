import supabase from '../config/supabase';
import { addLog } from '../config/state';
import accountingEngine from './accountingEngine';
import { withTransaction } from './db';
import { syncInventory } from './inventory';

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
  statusBayar?: string;
  customerName?: string;
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
    [userId],
  );
  if (acct.rows.length === 0) throw new Error('Akun Kas (1101) belum di-set. Hubungi admin.');
  const balance = parseFloat(acct.rows[0].balance) || 0;
  if (balance < amount) {
    throw new Error(`Saldo kas tidak cukup. Saldo: Rp ${balance.toLocaleString('id-ID')}`);
  }
}

async function recordTransaction(opts: RecordOpts): Promise<RecordResult> {
  const {
    userId,
    type,
    amount,
    description,
    productId,
    quantity,
    priceSell,
    priceBuy,
    profit,
    channel = 'Offline',
    referenceType = 'manual',
    hpp,
    bebanOperasional,
    customerName,
    statusBayar = 'tunai',
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

  const { data, error } = await supabase.from('transactions').insert([record]).select().single();

  if (error) {
    addLog('error', '[TRX-RECORDER] insert error: ' + error.message);
    return { success: false, error: `Gagal simpan transaksi: ${error.message}` };
  }

  return { success: true, data };
}

async function recordSale(opts: RecordSaleOpts): Promise<RecordResult> {
  const {
    userId,
    productId,
    quantity,
    priceSell,
    priceBuy,
    totalOmzet,
    channel = 'Offline',
    description,
    referenceType = 'cashier',
    statusBayar,
    customerName,
  } = opts;

  if (!userId) return { success: false, error: 'userId is required' };
  if (!productId) return { success: false, error: 'productId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };

  const qty = parseFloat(String(quantity));
  const sell = parseFloat(String(priceSell)) || 0;
  const buy = parseFloat(String(priceBuy)) || 0;
  const omzet = totalOmzet || qty * sell;
  const modal = qty * buy;
  const profit = omzet - modal;

  try {
    return await withTransaction(async (client) => {
      // 0. Resolve channel config
      const ch = await resolveChannel(userId, channel);
      const bebanAdmin = omzet * (ch.adminFeePct / 100);
      const danaBersih = omzet - bebanAdmin;
      const netProfit = danaBersih - modal;

      // 1. Lock product row + read current stock
      const prod = await client.query(
        `SELECT stock_current, stock_min, unit FROM products
         WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId],
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const stockBefore = parseFloat(prod.rows[0].stock_current) || 0;
      if (stockBefore < qty) {
        throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore}`);
      }

      // 2. Update stock
      const stockAfter = stockBefore - qty;
      await client.query(`UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`, [
        stockAfter,
        productId,
        userId,
      ]);
      await syncInventory(userId, String(productId), stockAfter, 'Utama', client);

      // 3. Insert stock_movements
      await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity,
         stock_before, stock_after, reference_type, created_via)
         VALUES ($1, $2, 'out', $3, $4, $5, 'cashier', 'system')`,
        [userId, productId, qty, stockBefore, stockAfter],
      );

      // 4. Insert transaction
      const bayar = statusBayar || 'tunai';
      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel,
         amount, description, reference_type, product_id, quantity,
         price_sell, price_buy, profit, hpp, customer_name)
         VALUES ($1, 'masuk', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          userId,
          bayar,
          channel,
          omzet,
          description || `Penjualan ${qty} item`,
          referenceType,
          productId,
          qty,
          sell,
          buy,
          netProfit,
          modal,
          customerName || null,
        ],
      );
      const trxId = trx.rows[0].id;

      // 5. Build journal lines
      const revenueLines: Array<{ accountCode: string; debit: number; credit: number; description?: string }> = [];
      if (bebanAdmin > 0) {
        revenueLines.push(
          { accountCode: '1101', debit: danaBersih, credit: 0, description: 'Penerimaan penjualan (bersih)' },
          {
            accountCode: '6105',
            debit: bebanAdmin,
            credit: 0,
            description: `Beban admin ${channel} ${ch.adminFeePct}%`,
          },
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

      // 6. Auto-create piutang for credit sales
      if (bayar !== 'tunai' && bayar !== 'lunas' && customerName) {
        try {
          const piutangLines = [
            { accountCode: '1102', debit: omzet, credit: 0, description: 'Piutang Dagang' },
            { accountCode: '4101', debit: 0, credit: omzet, description: 'Penjualan kredit' },
          ];
          await accountingEngine.insertJournalViaClient(client, userId, {
            referenceType: 'receivable',
            referenceId: String(trxId),
            description: `Piutang penjualan ${description || `${qty} item`} (Customer: ${customerName})`,
            lines: piutangLines,
          });
          await client.query(
            `INSERT INTO receivables (user_id, transaction_id, nama_pelanggan, nominal_piutang, status_lunas)
             VALUES ($1, $2, $3, $4, false)`,
            [userId, trxId, customerName, omzet],
          );
        } catch (piutangErr: any) {
          addLog('warn', '[TRX-RECORDER] Gagal buat piutang (non-blocking): ' + (piutangErr.message || piutangErr));
        }
      }

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
          profit: netProfit,
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
        [
          userId,
          statusBayar || 'tunai',
          amount,
          description || 'Pengeluaran',
          customerName || null,
          bebanOperasional || amount,
        ],
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
      const prod = await client.query(`SELECT stock_current FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`, [
        productId,
        userId,
      ]);
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const stockBefore = parseFloat(prod.rows[0].stock_current) || 0;
      if (stockBefore < qty) {
        throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore}`);
      }

      const stockAfter = stockBefore - qty;
      await client.query(`UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`, [
        stockAfter,
        productId,
        userId,
      ]);
      await syncInventory(userId, String(productId), stockAfter, 'Utama', client);

      await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, created_via)
         VALUES ($1, $2, 'out', $3, $4, $5, 'damaged', 'system')`,
        [userId, productId, qty, stockBefore, stockAfter],
      );

      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, reference_type, product_id, quantity, price_buy, beban_operasional)
         VALUES ($1, 'keluar', 'tunai', 'Offline', $2, $3, 'manual', $4, $5, $6, $7)
         RETURNING id`,
        [userId, loss, description || `Barang rusak/susut ${qty} item`, productId, qty, buy, loss],
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

interface SalesReturnOpts {
  userId: string;
  originalTransactionId: string | number;
  productId: string;
  quantity: number;
  priceSell: number;
  priceBuy: number;
  returnReason: string;
  statusBayar: 'tunai' | 'piutang';
  channel?: string;
  customerName?: string;
}

interface PurchaseReturnOpts {
  userId: string;
  originalTransactionId: string | number;
  productId: string;
  quantity: number;
  priceBuy: number;
  returnReason: string;
  statusBayar: 'tunai' | 'hutang';
  supplierName?: string;
}

interface InventoryAdjustmentOpts {
  userId: string;
  opnameId?: string | number;
  items: Array<{
    productId: string;
    systemQty: number;
    actualQty: number;
    priceBuy: number;
    varianceType: 'shortage' | 'overage';
  }>;
  notes?: string;
}

const PEMBUKUAN_COA_MAP: Record<string, { debit: string; credit: string; label: string }> = {
  beban_gaji: { debit: '6101', credit: '1101', label: 'Beban Gaji' },
  beban_sewa: { debit: '6102', credit: '1101', label: 'Beban Sewa' },
  beban_listrik_air: { debit: '6103', credit: '1101', label: 'Beban Listrik & Air' },
  beban_transport: { debit: '6104', credit: '1101', label: 'Beban Transport' },
  beban_operasional: { debit: '6105', credit: '1101', label: 'Beban Operasional Lainnya' },
  modal: { debit: '1101', credit: '3101', label: 'Modal Pemilik' },
  prive: { debit: '3102', credit: '1101', label: 'Prive' },
  piutang: { debit: '1102', credit: '4101', label: 'Piutang Dagang' },
  hutang_dagang: { debit: '1201', credit: '2101', label: 'Hutang Dagang' },
  hutang_lancar: { debit: '6105', credit: '2101', label: 'Hutang Lancar' },
  hutang_gaji: { debit: '6101', credit: '2103', label: 'Hutang Gaji' },
  hutang_sewa: { debit: '6102', credit: '2103', label: 'Hutang Sewa' },
  hutang_listrik_air: { debit: '6103', credit: '2103', label: 'Hutang Listrik & Air' },
  hutang_transport: { debit: '6104', credit: '2103', label: 'Hutang Transport' },
  hutang_operasional: { debit: '6105', credit: '2103', label: 'Hutang Operasional Lainnya' },
  sales_return: { debit: '4102', credit: '1101', label: 'Retur Penjualan' },
  purchase_return: { debit: '2101', credit: '1201', label: 'Retur Pembelian' },
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
  const effectiveCredit = tipe === 'piutang' && channel ? (await resolveChannel(userId, channel)).coaCode : creditCode;

  if (['piutang', 'hutang_dagang', 'hutang_lancar', 'hutang_gaji', 'hutang_sewa', 'hutang_listrik_air', 'hutang_transport', 'hutang_operasional'].includes(tipe) && !customerName) {
    return { success: false, error: 'customerName is required for piutang/hutang' };
  }

  const lines = [
    { accountCode: debitCode, debit: Number(amount), credit: 0, description: coaMap ? coaMap.label : tipe },
    {
      accountCode: effectiveCredit,
      debit: 0,
      credit: Number(amount),
      description: `Pembayaran ${coaMap ? coaMap.label : tipe}`,
    },
  ];

  // Hutang dagang/lancar: journal only (no cash transaction)
  const hutangTypes = ['hutang_dagang', 'hutang_lancar', 'hutang_gaji', 'hutang_sewa', 'hutang_listrik_air', 'hutang_transport', 'hutang_operasional'];
  if (hutangTypes.includes(tipe)) {
    try {
      return await withTransaction(async (client) => {
        const jr = await accountingEngine.insertJournalViaClient(client, userId, {
          entryDate: new Date(),
          referenceType: 'pembukuan',
          description: `${coaMap ? coaMap.label : tipe}: ${description}`,
          lines,
        });

        if (tipe === 'hutang_dagang') {
          await client.query(
            `INSERT INTO payables (user_id, nama_supplier, nominal_hutang, deskripsi, status_lunas)
             VALUES ($1, $2, $3, $4, false)`,
            [userId, customerName || 'Unknown', Number(amount), description],
          );
        }

        return { success: true, data: { journalId: jr.journalId } };
      });
    } catch (err: any) {
      return { success: false, error: `Jurnal gagal: ${err.message}` };
    }
  }

  const trxType =
    tipe.startsWith('beban') || tipe === 'prive'
      ? 'keluar'
      : tipe === 'modal' || tipe === 'piutang'
        ? 'masuk'
        : 'keluar';

  const trxRefType = tipe === 'modal' ? 'modal' : tipe === 'piutang' ? 'receivable' : 'pembukuan';

  const trxDesc =
    customerName && tipe === 'piutang'
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
        [userId, trxType, channel || 'Offline', Number(amount), trxDesc, trxRefType, customerName || null],
      );
      const trxId = trx.rows[0].id;

      const jr = await accountingEngine.insertJournalViaClient(client, userId, {
        entryDate: new Date(),
        referenceType: 'pembukuan',
        referenceId: String(trxId),
        description: `${coaMap ? coaMap.label : tipe}: ${description}`,
        lines,
      });

      if (tipe === 'piutang') {
        await client.query(
          `INSERT INTO receivables (user_id, transaction_id, nama_pelanggan, nominal_piutang, status_lunas)
           VALUES ($1, $2, $3, $4, false)`,
          [userId, trxId, customerName || 'Unknown', Number(amount)],
        );
      }

      return { success: true, data: { transaction: { id: trxId }, journalId: jr.journalId } };
    });
  } catch (err: any) {
    return { success: false, error: `Pembukuan gagal: ${err.message}` };
  }
}

async function recordTransactionWithJournal(
  userId: string,
  type: string,
  amount: number,
  description: string,
  productId?: string,
  demoCheck?: boolean,
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
          [userId],
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
        [userId, type, amount, description || '', productId || null],
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
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  note?: string;
  unitPrice?: number;
  channel?: string;
  createdVia?: 'whatsapp' | 'dashboard';
  recordTransaction?: boolean;
}): Promise<RecordResult> {
  const {
    userId,
    productId,
    type,
    quantity,
    note,
    unitPrice,
    channel = 'Offline',
    createdVia = 'whatsapp',
    recordTransaction = false,
  } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!productId) return { success: false, error: 'productId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };
  if (!['in', 'out', 'adjustment'].includes(type)) return { success: false, error: 'type must be in, out, or adjustment' };
  try {
    return await withTransaction(async (client) => {
      const prod = await client.query(
        `SELECT id, name, stock_current, stock_min, unit, price_buy, price_sell FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId],
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');
      const p = prod.rows[0];
      const stockBefore = parseFloat(p.stock_current) || 0;
      const stockAfter = type === 'in' || type === 'adjustment' ? stockBefore + quantity : stockBefore - quantity;
      if (stockAfter < 0) throw new Error(`Stok tidak cukup. Stok saat ini: ${stockBefore} ${p.unit}`);
      await client.query(`UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`, [
        stockAfter,
        productId,
        userId,
      ]);
      await syncInventory(userId, String(productId), stockAfter, 'Utama', client);
      const mov = await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_via)
         VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, $8)
         RETURNING id`,
        [userId, productId, type, quantity, stockBefore, stockAfter, note || null, createdVia],
      );
      const movId = mov.rows[0].id;
      if (type === 'in') {
        const buyPrice = unitPrice || parseFloat(p.price_buy) || 0;
        const totalValue = quantity * buyPrice;
        if (unitPrice || parseFloat(p.price_buy) > 0) {
          await client.query(`UPDATE stock_movements SET unit_price = $1, total_value = $2 WHERE id = $3`, [
            buyPrice,
            totalValue,
            movId,
          ]);
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
      } else if (type === 'out') {
        const ch = await resolveChannel(userId, channel);
        const sellPrice = parseFloat(p.price_sell) || 0;
        const buyPrice = parseFloat(p.price_buy) || 0;
        const omzet = quantity * sellPrice;
        const modal = quantity * buyPrice;
        const bebanAdmin = omzet * (ch.adminFeePct / 100);
        const danaBersih = omzet - bebanAdmin;

        if (sellPrice > 0) {
          await client.query(`UPDATE stock_movements SET unit_price = $1, total_value = $2 WHERE id = $3`, [
            sellPrice,
            omzet,
            movId,
          ]);
        }
        if (omzet > 0) {
          const lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }> = [];
          if (bebanAdmin > 0) {
            lines.push(
              { accountCode: '1101', debit: danaBersih, credit: 0, description: 'Penerimaan penjualan (bersih)' },
              {
                accountCode: '6105',
                debit: bebanAdmin,
                credit: 0,
                description: `Beban admin ${channel} ${ch.adminFeePct}%`,
              },
              { accountCode: ch.coaCode, debit: 0, credit: omzet, description: `Penjualan via ${channel}` },
            );
          } else {
            lines.push(
              { accountCode: '1101', debit: omzet, credit: 0, description: 'Penerimaan penjualan' },
              { accountCode: ch.coaCode, debit: 0, credit: omzet, description: `Penjualan via ${channel}` },
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
            description: `Penjualan ${quantity} ${p.unit}: ${p.name}${channel ? ` (${channel})` : ''}`,
            lines,
          });

          if (recordTransaction) {
            const netProfit = omzet - modal - bebanAdmin;
            await client.query(
              `INSERT INTO transactions (user_id, type, status_bayar, channel, amount, description, reference_type, product_id, quantity, price_sell, price_buy, profit, hpp)
               VALUES ($1, 'masuk', 'tunai', $2, $3, $4, 'stock_out', $5, $6, $7, $8, $9, $10)`,
              [
                userId,
                channel || 'Offline',
                omzet,
                `Penjualan ${quantity} ${p.unit}: ${p.name} [mov:${movId}]`,
                productId,
                quantity,
                sellPrice,
                buyPrice,
                netProfit,
                modal,
              ],
            );
          }
        }
      }
      return {
        success: true,
        data: {
          stockBefore,
          stockAfter,
          movId,
          product: { id: p.id, name: p.name, unit: p.unit, stock_min: p.stock_min },
        },
      };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordStockAdjustment failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

interface PayPayableOpts {
  userId: string;
  payableId: string;
  amount: number;
  description?: string;
}

interface ReceiveReceivableOpts {
  userId: string;
  debtId: string;
  amount: number;
  description?: string;
}

async function recordPayPayable(opts: PayPayableOpts): Promise<RecordResult> {
  const { userId, payableId, amount, description } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!payableId) return { success: false, error: 'payableId is required' };
  if (!amount || amount <= 0) return { success: false, error: 'amount must be > 0' };

  try {
    return await withTransaction(async (client) => {
      const pay = await client.query(
        `SELECT id, nominal_hutang, jumlah_dibayar, status_lunas, nama_supplier
         FROM payables WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [payableId, userId],
      );
      if (pay.rows.length === 0) throw new Error('Hutang tidak ditemukan');

      const p = pay.rows[0];
      if (p.status_lunas) throw new Error('Hutang sudah lunas');

      const paidSoFar = parseFloat(p.jumlah_dibayar) || 0;
      const totalHutang = parseFloat(p.nominal_hutang) || 0;
      const sisa = totalHutang - paidSoFar;
      if (amount > sisa) throw new Error(`Jumlah bayar (${amount}) melebihi sisa hutang (${sisa})`);

      await lockAndCheckCashBalance(client, userId, amount);

      const newPaid = paidSoFar + amount;
      const isLunas = Math.abs(newPaid - totalHutang) < 0.01;

      await client.query(
        `UPDATE payables SET jumlah_dibayar = $1, status_lunas = $2 WHERE id = $3`,
        [newPaid, isLunas, payableId],
      );

      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'pay_payable',
        referenceId: payableId,
        description: description || `Pembayaran hutang ke ${p.nama_supplier} ${isLunas ? '(LUNAS)' : `(sisa Rp${sisa - amount})`}`,
        lines: [
          { accountCode: '2101', debit: amount, credit: 0, description: `Bayar hutang: ${p.nama_supplier}` },
          { accountCode: '1101', debit: 0, credit: amount, description: 'Pembayaran hutang' },
        ],
      });

      return { success: true, data: { payableId, sisaBaru: totalHutang - newPaid, lunas: isLunas } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordPayPayable failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function recordReceiveReceivable(opts: ReceiveReceivableOpts): Promise<RecordResult> {
  const { userId, debtId, amount, description } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!debtId) return { success: false, error: 'debtId is required' };
  if (!amount || amount <= 0) return { success: false, error: 'amount must be > 0' };

  try {
    return await withTransaction(async (client) => {
      const d = await client.query(
        `SELECT id, nominal_piutang, status_lunas, nama_pelanggan
         FROM receivables WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [debtId, userId],
      );
      if (d.rows.length === 0) throw new Error('Piutang tidak ditemukan');

      const debt = d.rows[0];
      if (debt.status_lunas) throw new Error('Piutang sudah lunas');

      const totalPiutang = parseFloat(debt.nominal_piutang) || 0;
      const sisa = totalPiutang;
      if (amount > sisa) throw new Error(`Jumlah diterima (${amount}) melebihi sisa piutang (${sisa})`);

      // Check if there's an existing paid amount via transaction.status_bayar flow
      const isLunas = Math.abs(amount - totalPiutang) < 0.01;

      await client.query(
        `UPDATE receivables SET status_lunas = $1 WHERE id = $2`,
        [isLunas, debtId],
      );

      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'receive_receivable',
        referenceId: debtId,
        description: description || `Penerimaan piutang dari ${debt.nama_pelanggan} ${isLunas ? '(LUNAS)' : `(sisa Rp${totalPiutang - amount})`}`,
        lines: [
          { accountCode: '1101', debit: amount, credit: 0, description: `Terima piutang: ${debt.nama_pelanggan}` },
          { accountCode: '1102', debit: 0, credit: amount, description: 'Pelunasan piutang' },
        ],
      });

      return { success: true, data: { debtId, sisaBaru: totalPiutang - amount, lunas: isLunas } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordReceiveReceivable failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ===== SALES RETURN =====
async function recordSalesReturn(opts: SalesReturnOpts): Promise<RecordResult> {
  const { userId, originalTransactionId, productId, quantity, priceSell, priceBuy, returnReason, statusBayar, channel, customerName } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!originalTransactionId) return { success: false, error: 'originalTransactionId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };

  const qty = parseFloat(String(quantity));
  const sell = parseFloat(String(priceSell)) || 0;
  const buy = parseFloat(String(priceBuy)) || 0;
  const returnAmount = qty * sell;
  const cogsValue = qty * buy;

  try {
    return await withTransaction(async (client) => {
      // 1. Lock product row
      const prod = await client.query(
        `SELECT stock_current FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId],
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');

      // 2. Update inventory (return adds stock back)
      const stockBefore = parseFloat(prod.rows[0].stock_current) || 0;
      const stockAfter = stockBefore + qty;
      await client.query(`UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`, [
        stockAfter,
        productId,
        userId,
      ]);
      await syncInventory(userId, String(productId), stockAfter, 'Utama', client);

      // 3. Insert stock_movements
      await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_by)
         VALUES ($1, $2, 'in', $3, $4, $5, 'sales_return', $6, 'system')`,
        [userId, productId, qty, stockBefore, stockAfter, returnReason],
      );

      // 4. Create return transaction
      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, amount, description, reference_type, product_id, quantity, price_sell, price_buy, customer_name, original_transaction_id, return_reason)
         VALUES ($1, 'sales_return', $2, $3, $4, 'sales_return', $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          userId,
          statusBayar,
          returnAmount,
          returnReason,
          productId,
          qty,
          sell,
          buy,
          customerName || null,
          originalTransactionId,
          returnReason,
        ],
      );
      const trxId = trx.rows[0].id;

      // 5. Journal Entry 1: Reverse Revenue
      const isPiutang = statusBayar === 'piutang';
      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'sales_return',
        referenceId: String(trxId),
        description: `Retur penjualan: ${returnReason}`,
        lines: [
          { accountCode: '4102', debit: returnAmount, credit: 0, description: 'Retur Penjualan' },
          { accountCode: isPiutang ? '1102' : '1101', debit: 0, credit: returnAmount, description: isPiutang ? 'Pengurangan piutang' : 'Refund retur' },
        ],
      });

      // 6. Journal Entry 2: Reverse HPP
      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'sales_return_hpp',
        referenceId: String(trxId),
        description: `HPP retur: ${returnReason}`,
        lines: [
          { accountCode: '1201', debit: cogsValue, credit: 0, description: 'Barang retur masuk' },
          { accountCode: '5101', debit: 0, credit: cogsValue, description: 'Reverse HPP retur' },
        ],
      });

      // 7. If original was piutang, reduce receivable
      if (isPiutang && customerName) {
        const debtRows = await client.query(
          `SELECT id, nominal_piutang FROM receivables WHERE transaction_id = $1 AND user_id = $2 AND status_lunas = false FOR UPDATE`,
          [originalTransactionId, userId],
        );
        if (debtRows.rows.length > 0) {
          const debt = debtRows.rows[0];
          const sisa = parseFloat(debt.nominal_piutang) - returnAmount;
          if (sisa <= 0) {
            await client.query(`UPDATE receivables SET nominal_piutang = 0, status_lunas = true WHERE id = $1`, [debt.id]);
          } else {
            await client.query(`UPDATE receivables SET nominal_piutang = $1 WHERE id = $2`, [sisa, debt.id]);
          }
        }
      }

      return { success: true, data: { trxId, stockAfter } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordSalesReturn failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ===== PURCHASE RETURN =====
async function recordPurchaseReturn(opts: PurchaseReturnOpts): Promise<RecordResult> {
  const { userId, originalTransactionId, productId, quantity, priceBuy, returnReason, statusBayar, supplierName } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!originalTransactionId) return { success: false, error: 'originalTransactionId is required' };
  if (!quantity || quantity <= 0) return { success: false, error: 'quantity must be > 0' };

  const qty = parseFloat(String(quantity));
  const buy = parseFloat(String(priceBuy)) || 0;
  const returnAmount = qty * buy;

  try {
    return await withTransaction(async (client) => {
      // 1. Lock product row
      const prod = await client.query(
        `SELECT stock_current FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [productId, userId],
      );
      if (prod.rows.length === 0) throw new Error('Produk tidak ditemukan');

      // 2. Update inventory (return reduces stock)
      const stockBefore = parseFloat(prod.rows[0].stock_current) || 0;
      if (stockBefore < qty) throw new Error(`Stok tidak cukup untuk retur. Stok: ${stockBefore}`);
      const stockAfter = stockBefore - qty;
      await client.query(`UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`, [
        stockAfter,
        productId,
        userId,
      ]);
      await syncInventory(userId, String(productId), stockAfter, 'Utama', client);

      // 3. Insert stock_movements
      await client.query(
        `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_by)
         VALUES ($1, $2, 'out', $3, $4, $5, 'purchase_return', $6, 'system')`,
        [userId, productId, qty, stockBefore, stockAfter, returnReason],
      );

      // 4. Create return transaction
      const trx = await client.query(
        `INSERT INTO transactions (user_id, type, status_bayar, amount, description, reference_type, product_id, quantity, price_buy, customer_name, original_transaction_id, return_reason)
         VALUES ($1, 'purchase_return', $2, $3, $4, 'purchase_return', $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          userId,
          statusBayar,
          returnAmount,
          returnReason,
          productId,
          qty,
          buy,
          supplierName || null,
          originalTransactionId,
          returnReason,
        ],
      );
      const trxId = trx.rows[0].id;

      // 5. Journal Entry: Reverse Purchase
      const isHutang = statusBayar === 'hutang';
      await accountingEngine.insertJournalViaClient(client, userId, {
        referenceType: 'purchase_return',
        referenceId: String(trxId),
        description: `Retur pembelian: ${returnReason}`,
        lines: [
          { accountCode: isHutang ? '2101' : '1101', debit: returnAmount, credit: 0, description: isHutang ? 'Pengurangan hutang' : 'Refund retur beli' },
          { accountCode: '1201', debit: 0, credit: returnAmount, description: 'Barang retur keluar' },
        ],
      });

      // 6. If original was hutang, reduce payable
      if (isHutang && supplierName) {
        const payRows = await client.query(
          `SELECT id, nominal_hutang, jumlah_dibayar FROM payables WHERE transaction_id = $1 AND user_id = $2 AND status_lunas = false FOR UPDATE`,
          [originalTransactionId, userId],
        );
        if (payRows.rows.length > 0) {
          const pay = payRows.rows[0];
          const sisa = parseFloat(pay.nominal_hutang) - returnAmount - parseFloat(pay.jumlah_dibayar || 0);
          if (sisa <= 0) {
            await client.query(`UPDATE payables SET nominal_hutang = 0, status_lunas = true WHERE id = $1`, [pay.id]);
          } else {
            await client.query(`UPDATE payables SET nominal_hutang = nominal_hutang - $1 WHERE id = $2`, [returnAmount, pay.id]);
          }
        }
      }

      return { success: true, data: { trxId, stockAfter } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordPurchaseReturn failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ===== INVENTORY ADJUSTMENT (Opname) =====
async function recordInventoryAdjustment(opts: InventoryAdjustmentOpts): Promise<RecordResult> {
  const { userId, opnameId, items, notes } = opts;
  if (!userId) return { success: false, error: 'userId is required' };
  if (!items || items.length === 0) return { success: false, error: 'items is required' };

  try {
    return await withTransaction(async (client) => {
      const results: Array<{ productId: string; stockAfter: number }> = [];

      for (const item of items) {
        const { productId, systemQty, actualQty, priceBuy } = item;
        const variance = actualQty - systemQty;
        const varianceValue = Math.abs(variance) * priceBuy;

        // Lock product row
        const prod = await client.query(
          `SELECT stock_current FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [productId, userId],
        );
        if (prod.rows.length === 0) throw new Error(`Produk ${productId} tidak ditemukan`);

        // Update inventory to actual
        await client.query(`UPDATE products SET stock_current = $1 WHERE id = $2 AND user_id = $3`, [
          actualQty,
          productId,
          userId,
        ]);
        await syncInventory(userId, String(productId), actualQty, 'Utama', client);

        // Insert stock_movements
        await client.query(
          `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_by)
           VALUES ($1, $2, 'adjustment', $3, $4, $5, 'inventory_adjustment', $6, 'system')`,
          [userId, productId, variance, systemQty, actualQty, notes || `Penyesuaian opname: ${variance > 0 ? 'kelebihan' : 'kekurangan'} ${Math.abs(variance)}`],
        );

        // Create journal for variance
        if (variance !== 0) {
          const isShortage = variance < 0;
          const adjAmt = Math.abs(variance) * priceBuy;
          if (adjAmt > 0) {
            await accountingEngine.insertJournalViaClient(client, userId, {
              referenceType: 'inventory_adjustment',
              referenceId: `${productId}_${opnameId || 'manual'}`,
              description: `Penyesuaian inventori: ${isShortage ? 'shortage' : 'overage'} ${Math.abs(variance)} ${notes || ''}`,
              lines: isShortage
                ? [
                    { accountCode: '6101', debit: adjAmt, credit: 0, description: `Shortage ${Math.abs(variance)} x ${priceBuy}` },
                    { accountCode: '1201', debit: 0, credit: adjAmt, description: 'Pengurangan inventori' },
                  ]
                : [
                    { accountCode: '1201', debit: adjAmt, credit: 0, description: `Overage ${variance} x ${priceBuy}` },
                    { accountCode: '4104', debit: 0, credit: adjAmt, description: 'Keuntungan persediaan' },
                  ],
            });
          }
        }

        results.push({ productId, stockAfter: actualQty });
      }

      return { success: true, data: { results, count: items.length } };
    });
  } catch (err: any) {
    addLog('error', '[TRX-RECORDER] recordInventoryAdjustment failed: ' + err.message);
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
  recordPayPayable,
  recordReceiveReceivable,
  recordSalesReturn,
  recordPurchaseReturn,
  recordInventoryAdjustment,

  PEMBUKUAN_COA_MAP,
  invalidateChannelCache,
};
