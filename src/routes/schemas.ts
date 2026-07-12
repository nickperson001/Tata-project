import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['demo', 'pro', 'unlimited']),
});

export const broadcastSchema = z.object({
  message: z.string().min(1, 'Pesan tidak boleh kosong').max(5000, 'Pesan maksimal 5000 karakter'),
  target: z.enum(['all', 'demo', 'pro', 'unlimited']).default('all'),
});

export const productSchema = z.object({
  sku: z.string().min(1, 'SKU wajib diisi').max(50),
  name: z.string().min(1, 'Nama produk wajib diisi').max(255),
  category: z.string().max(100).optional(),
  unit: z.string().max(20).optional(),
  priceBuy: z.number().nonnegative('Harga beli tidak boleh negatif').optional(),
  priceSell: z.number().positive('Harga jual harus lebih dari 0'),
  stockInitial: z.number().int('Stok awal harus bilangan bulat').nonnegative().optional(),
  stockMin: z.number().int('Stok minimal harus bilangan bulat').nonnegative().optional(),
  description: z.string().max(500).optional(),
});

export const pairingCodeSchema = z.object({
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, 'Nomor telepon harus 10-15 digit angka'),
});

export const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional(),
});

export const userQuerySchema = z.object({
  search: z.string().optional().default(''),
  status: z.enum(['all', 'demo', 'pro', 'unlimited']).optional().default('all'),
  page: z.coerce.number().int().positive().optional().default(1),
});

export const waAuthSchema = z.object({
  whatsapp: z.string().min(1, 'Nomor WhatsApp wajib diisi'),
});

export const movementSchema = z.object({
  product_id: z.string().min(1, 'Produk wajib dipilih'),
  type: z.enum(['in', 'out', 'adjustment'], { message: 'Tipe harus in, out, atau adjustment' }),
  quantity: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  note: z.string().max(500).optional().default(''),
  unit_price: z.coerce.number().nonnegative().optional(),
  channel: z.string().max(50).optional(),
});

const PEMBUKUAN_TYPES = [
  'beban_gaji',
  'beban_sewa',
  'beban_listrik_air',
  'beban_transport',
  'beban_operasional',
  'modal',
  'prive',
  'piutang',
  'hutang_dagang',
  'hutang_lancar',
] as const;

export const pembukuanSchema = z.object({
  type: z.enum(PEMBUKUAN_TYPES, { message: 'Tipe pembukuan tidak valid' }),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0'),
  description: z.string().min(1, 'Deskripsi wajib diisi').max(500),
  customerName: z.string().max(100).optional(),
  coaDebit: z.string().max(10).optional(),
  coaCredit: z.string().max(10).optional(),
  channel: z.string().max(50).optional(),
});

export const productCreateSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi').max(150),
  sku: z.string().max(50).optional().default(''),
  category: z.string().max(50).optional(),
  unit: z.string().max(20).optional(),
  price_buy: z.coerce.number().nonnegative().optional(),
  priceBuy: z.coerce.number().nonnegative().optional(),
  price_sell: z.coerce.number().nonnegative().optional(),
  priceSell: z.coerce.number().nonnegative().optional(),
  stock_initial: z.coerce.number().nonnegative().optional(),
  stockInitial: z.coerce.number().nonnegative().optional(),
  stock_min: z.coerce.number().nonnegative().optional(),
  stockMin: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  supplier: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  default_channel: z.string().max(30).optional(),
  channels: z.array(z.string().max(30)).optional(),
});

export const hutangSchema = z.object({
  nama_supplier: z.string().min(1, 'Nama supplier wajib diisi').max(150),
  nominal_hutang: z.coerce.number().positive('Nominal hutang harus lebih dari 0'),
  deskripsi: z.string().max(500).optional().default(''),
  jatuh_tempo: z.string().optional(),
});

export const salesReturnSchema = z.object({
  originalTransactionId: z.string().min(1, 'ID transaksi original wajib diisi'),
  productId: z.string().min(1, 'ID produk wajib diisi'),
  quantity: z.coerce.number().positive('Jumlah retur harus lebih dari 0'),
  priceSell: z.coerce.number().nonnegative(),
  priceBuy: z.coerce.number().nonnegative(),
  returnReason: z.string().min(1, 'Alasan retur wajib diisi').max(500),
  statusBayar: z.enum(['tunai', 'piutang']).default('tunai'),
  channel: z.string().max(50).optional(),
});

export const purchaseReturnSchema = z.object({
  originalTransactionId: z.string().min(1, 'ID transaksi original wajib diisi'),
  productId: z.string().min(1, 'ID produk wajib diisi'),
  quantity: z.coerce.number().positive('Jumlah retur harus lebih dari 0'),
  priceBuy: z.coerce.number().nonnegative(),
  returnReason: z.string().min(1, 'Alasan retur wajib diisi').max(500),
  statusBayar: z.enum(['tunai', 'hutang']).default('tunai'),
});

export const opnameCreateSchema = z.object({
  warehouse: z.string().max(100).optional().default('Utama'),
  notes: z.string().max(500).optional(),
});

export const opnameDetailSchema = z.object({
  productId: z.string().min(1, 'ID produk wajib diisi'),
  actualQty: z.coerce.number().nonnegative('Jumlah fisik tidak boleh negatif'),
  systemQty: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export const materialCreateSchema = z.object({
  name: z.string().min(1, 'Nama material wajib diisi').max(150),
  unit: z.string().max(20).optional().default('pcs'),
  stock_current: z.coerce.number().nonnegative().optional().default(0),
  stock_min: z.coerce.number().nonnegative().optional().default(0),
  cost_per_unit: z.coerce.number().nonnegative().optional().default(0),
});

export const materialUpdateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  unit: z.string().max(20).optional(),
  stock_current: z.coerce.number().nonnegative().optional(),
  stock_min: z.coerce.number().nonnegative().optional(),
  cost_per_unit: z.coerce.number().nonnegative().optional(),
});

export const recipeUpsertSchema = z.object({
  material_id: z.coerce.number().positive('Material wajib dipilih'),
  product_id: z.coerce.number().nullable().optional().default(null),
  quantity_per_order: z.coerce.number().positive('Jumlah per order harus lebih dari 0'),
  auto_deduct: z.boolean().optional().default(true),
});

export const settingUpdateSchema = z
  .object({
    channel_fees: z
      .array(
        z.object({
          name: z.string().min(1),
          admin_fee_pct: z.coerce.number().min(0).max(100).optional(),
        }),
      )
      .optional(),
  })
  .passthrough();
