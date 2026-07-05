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

export const chatSchema = z.object({
  message: z.string().min(1, 'Pesan tidak boleh kosong'),
});

export const movementSchema = z.object({
  product_id: z.string().min(1, 'Produk wajib dipilih'),
  type: z.enum(['in', 'out'], { message: 'Tipe harus in atau out' }),
  quantity: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  note: z.string().max(500).optional().default(''),
  unit_price: z.coerce.number().nonnegative().optional(),
  channel: z.string().max(50).optional(),
});

export const pembukuanSchema = z.object({
  type: z.enum(['masuk', 'keluar'], { message: 'Tipe harus masuk atau keluar' }),
  amount: z.coerce.number().positive('Nominal harus lebih dari 0'),
  description: z.string().min(1, 'Deskripsi wajib diisi').max(500),
  customerName: z.string().max(100).optional(),
  coaDebit: z.string().max(10).optional(),
  coaCredit: z.string().max(10).optional(),
  channel: z.string().max(50).optional(),
});

export const hutangSchema = z.object({
  nama_supplier: z.string().min(1, 'Nama supplier wajib diisi').max(150),
  nominal_hutang: z.coerce.number().positive('Nominal hutang harus lebih dari 0'),
  deskripsi: z.string().max(500).optional().default(''),
  jatuh_tempo: z.string().optional(),
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
