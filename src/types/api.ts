/**
 * ============================================================
 * SHARED API CONTRACTS — BE ↔ FE
 * ============================================================
 * Single source of truth untuk semua tipe response/request API.
 * Backend: definisikan tipe di sini SEBELUM buat route handler.
 * Frontend: import dari sini, DILARANG redefine.
 */

// ── Auth & User ──
export type SubscriptionTier = 'demo' | 'pro' | 'unlimited';

export interface User {
  id: string;
  store_name: string;
  slug: string;
  status: SubscriptionTier;
  subscription_expiry: string | null;
  dashboard_token: string | null;
  created_at: string;
}

// ── Bot ──
export type BotStatus =
  | 'Initializing'
  | 'QR_READY'
  | 'Authenticated'
  | 'AUTH_FAILED'
  | 'Ready'
  | 'Disconnected'
  | 'ERROR'
  | 'Reconnecting'
  | 'Processing';

export interface BotState {
  botStatus: BotStatus;
  currentQR: string;
  pairingCode: string;
  clientReady: boolean;
  maintenanceMode: boolean;
  waRetryCount: number;
  isInitializing: boolean;
  isBotRunning: boolean;
  waDestroyLock: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
  memory?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  system: {
    memory: { used: number; total: number; percentage: number };
  };
}

export interface MaintenanceMode {
  active: boolean;
  message: string;
}

// ── Product & Stock ──
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string | null;
  price_buy: number | null;
  price_sell: number;
  stock_current: number;
  stock_min: number | null;
  default_channel: string | null;
  description: string | null;
  user_id: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  unit_price: number | null;
  total_value: number | null;
  note: string | null;
  created_via: string | null;
  user_id: string;
  created_at: string;
  products?: { id: string; sku: string; name: string; unit: string };
}

export interface ReturnTransaction {
  id: string;
  user_id: string;
  type: 'sales_return' | 'purchase_return';
  amount: number;
  product_id: string;
  quantity: number;
  description: string;
  original_transaction_id: string;
  return_reason: string;
  status: string;
  created_at: string;
  products?: { id: string; sku: string; name: string; unit: string };
}

export interface StockOpname {
  id: string;
  user_id: string;
  opname_date: string;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  warehouse: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  details?: OpnameDetail[];
}

export interface OpnameDetail {
  id: string;
  opname_id: string;
  product_id: string;
  system_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_type: 'shortage' | 'overage' | 'matched';
  variance_value: number;
  notes: string | null;
  created_at: string;
  products?: { id: string; sku: string; name: string; unit: string };
}

// ── Overview / Dashboard ──
export interface OverviewData {
  total_omzet: number;
  total_hpp: number;
  total_pengeluaran: number;
  laba_bersih: number;
  piutang: number;
  profit_margin: number;
  total_product: number;
  nilai_inventori: number;
  stok_menipis: number;
  stok_habis: number;
}

export interface SaldoData {
  saldo: number;
  totalMasuk: number;
  totalKeluar: number;
}

export interface ChannelProfit {
  channel: string;
  revenue: number;
  hpp: number;
  netProfit: number;
  margin: number;
}

// ── Laba Rugi ──
export interface LabaRugiRow {
  account_code: string;
  account_name: string;
  account_type: 'revenue' | 'cogs' | 'expense';
  total: number;
}

export interface LabaRugiData {
  rows: LabaRugiRow[];
  totalRevenue: number;
  totalCOGS: number;
  totalExpense: number;
  labaKotor: number;
  labaBersih: number;
}

// ── Neraca ──
export interface NeracaItem {
  code: string;
  name: string;
  absolute: number;
}

export interface NeracaSection {
  items: NeracaItem[];
  total: number;
}

export interface NeracaData {
  date: string;
  totalAset: number;
  totalLiabilitasEkuitas: number;
  aset: NeracaSection;
  liabilitas: NeracaSection;
  ekuitas: NeracaSection;
  selisih: number;
}

// ── Buku Besar ──
export interface GeneralLedgerEntry {
  debit: number;
  credit: number;
  entry_date: string;
  reference_type: string;
  description: string;
}

export interface GeneralLedgerData {
  account: {
    code: string;
    name: string;
    type: string;
    normal_balance: string;
    balance: number;
  } | null;
  entries: GeneralLedgerEntry[];
}

// ── Trial Balance ──
export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceData {
  rows: TrialBalanceRow[];
}

// ── Cashflow ──
export interface CashflowItem {
  date: string;
  masuk: number;
  keluar: number;
}

// ── Piutang ──
export interface PiutangItem {
  id: string;
  nama: string;
  jumlah: number;
  tanggal: string;
  jatuh_tempo: string;
  status: 'lunas' | 'belum' | 'overdue';
}

// ── Hutang ──
export interface HutangItem {
  id: string;
  nama_supplier: string;
  nominal_hutang: number;
  jumlah_dibayar: number;
  status_lunas: boolean;
  jatuh_tempo: string | null;
  deskripsi: string | null;
  created_at: string;
}

// ── Jurnal ──
export interface JurnalLine {
  id: string;
  entry_id: string;
  account_code: string;
  debit: number;
  credit: number;
  description: string;
  account_name: string;
}

export interface JurnalEntryItem {
  id: string;
  user_id: string;
  entry_date: string;
  reference_type: string;
  reference_id: string;
  description: string;
  created_at: string;
  lines: JurnalLine[];
}

export interface JurnalData {
  list: JurnalEntryItem[];
  total: number;
  page: number;
  limit: number;
}

// ── Batch ──
export interface BatchProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock_current: number;
  stock_min: number;
  price_buy: number;
  price_sell: number;
  supplier: string;
  location: string;
  notes: string;
}

export interface BatchSummary {
  total: number;
  active: number;
  totalValue: number;
  lowStock: number;
  outStock: number;
  byCategory: Record<string, { count: number; value: number }>;
  alerts: BatchAlert[];
}

export interface BatchAlert {
  id: string;
  user_id: string;
  product_id: string;
  alert_type: string;
  stock_level: number;
  alerted_at: string;
  resolved_at: string | null;
  products: { id: string; sku: string; name: string; unit: string; stock_current: number; stock_min: number } | null;
}

export interface BatchMovement {
  id: string;
  user_id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string;
  note: string | null;
  created_via: string;
  created_at: string;
  products: { id: string; sku: string; name: string; unit: string } | null;
}

export interface BatchData {
  products: BatchProduct[];
  summary: BatchSummary;
  recentMovements: BatchMovement[];
}

// ── Product Stats ──
export interface ProductStatItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock_current: number;
  stock_min: number;
  price_buy: number;
  price_sell: number;
  profitPerUnit: number;
  margin: number;
  stockValue: number;
}

export interface ProductStatsData {
  products: ProductStatItem[];
}

export type StockSummaryData = BatchSummary;
export type ChannelsData = Record<string, number>;

// ── Broadcast ──
export interface BroadcastProgress {
  current: number;
  total: number;
  failed: number;
}

export interface BroadcastResult {
  success: number;
  failed: number;
  total: number;
}

// ── Pagination ──
export interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

// ── Journal Entry (legacy) ──
export interface JournalEntry {
  id: string;
  tanggal: string;
  deskripsi: string;
  debit: number;
  kredit: number;
  akun: string;
}

// ── Pembukuan ──
export interface TransItem {
  id: string;
  type: 'masuk' | 'keluar';
  amount: number;
  description: string;
  reference_type: string | null;
  created_at: string;
  channel?: string | null;
  products?: { name: string; sku: string; unit: string } | null;
}

export interface PembukuanData {
  transaksi: TransItem[];
  total: number;
  page: number;
  limit: number;
  totalMasuk: number;
  totalKeluar: number;
}

// ── Real Sales Analytics ──
export interface RealProductSale {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  price_sell: number;
  price_buy: number;
  qty: number;
  revenue: number;
  hpp: number;
  profit: number;
  txCount: number;
  avgMargin: number;
}

export interface SalesByCategory {
  category: string;
  qty: number;
  revenue: number;
  hpp: number;
  profit: number;
  productCount: number;
}

export interface SalesReportData {
  summary: {
    totalRevenue: number;
    totalHPP: number;
    totalProfit: number;
    totalQty: number;
    totalProducts: number;
  };
  products: RealProductSale[];
  byCategory: SalesByCategory[];
}

// ── Stock Report ──
export interface ReportData {
  totalIn: number;
  totalOut: number;
  totalAdj: number;
  count: number;
  topOut: Array<{ name: string; sku: string; category: string; total: number; pct: number; unit: string }>;
  byCategory: Record<string, { count: number; value: number }>;
  salesByCategory: Array<{ category: string; qty: number; revenue: number; pct: number }>;
  total: number;
}

// ── BOM / Packaging ──
export interface BomMaterial {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  stock_current: number;
  stock_min: number;
  cost_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BomRecipe {
  id: string;
  user_id: string;
  material_id: string;
  product_id: string | null;
  quantity_per_order: number;
  auto_deduct: boolean;
  created_at: string;
  bom_materials?: BomMaterial;
}

export interface BomDeductionLog {
  id: string;
  user_id: string;
  material_id: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string;
  reference_note: string | null;
  created_at: string;
  bom_materials?: { id: string; name: string; unit: string };
}

// ── Generic API Response wrapper ──
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
