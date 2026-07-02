export interface PackageConfig {
  key: string;
  label: string;
  emoji: string;
  price: number;
  priceStr: string;
  duration: number | null;
  features: string[];
}

export interface PaymentConfig {
  bank: string;
  account: string;
  name: string;
}

export const PACKAGES: Record<string, PackageConfig> = {
  pro: {
    key: 'pro',
    label: 'PRO Bulanan',
    emoji: '⭐',
    price: 49_000,
    priceStr: 'Rp 49.000/bulan',
    duration: 30,
    features: [
      'Transaksi tanpa batas per hari',
      'Laporan mingguan otomatis',
      'Dashboard web stok (tambah/kurang/opname)',
      'Alert stock minimum otomatis',
      'Berlaku 30 hari, bisa diperpanjang',
    ],
  },
  unlimited: {
    key: 'unlimited',
    label: 'UNLIMITED Selamanya',
    emoji: '💎',
    price: 499_000,
    priceStr: 'Rp 499.000 (sekali bayar)',
    duration: null,
    features: [
      'Transaksi tanpa batas per hari',
      'Semua laporan otomatis (harian, mingguan, bulanan)',
      'Dashboard web stok enterprise (unlimited produk)',
      'Alert stock + rekomendasi restock',
      'Berlaku SEUMUR HIDUP — tidak perlu perpanjang',
      'Prioritas support admin',
    ],
  },
};

export const PAYMENT: PaymentConfig = {
  bank: process.env.PAYMENT_BANK || 'BCA',
  account: process.env.PAYMENT_ACCOUNT || '8670662536',
  name: process.env.PAYMENT_NAME || 'HANAN RIDWAN HANIF',
};
