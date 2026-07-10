import { HelpCircle, BookOpen, Package, CreditCard, BarChart3, Settings } from 'lucide-react';

const menuItems = [
  {
    group: 'Dashboard',
    icon: HelpCircle,
    items: [
      { to: '/stock', label: 'Dashboard Utama', desc: 'Ringkasan seluruh bisnis: saldo kas, laba rugi, inventori, piutang, dan grafik harian.' },
    ],
  },
  {
    group: 'Keuangan',
    icon: BookOpen,
    items: [
      { to: '/stock/keuangan', label: 'Laporan Keuangan', desc: 'Catat transaksi (uang masuk/keluar), lihat ringkasan laba rugi, nilai inventori, dan verifikasi neraca dalam satu halaman.' },
    ],
  },
  {
    group: 'Inventori',
    icon: Package,
    items: [
      { to: '/stock/products', label: 'Produk', desc: 'Tambah/edit/hapus produk, atur harga, SKU, kategori, stok minimal.' },
      { to: '/stock/categories', label: 'Kategori', desc: 'Kelola grouping produk untuk filter dan laporan.' },
      { to: '#', label: 'Masuk/Keluar', desc: 'Catat pergerakan stok via tombol + (FAB) di kanan bawah — pilih Stok Masuk/Keluar.' },
      { to: '#', label: 'Opname', desc: 'Stok opname fisik via tombol + (FAB) di kanan bawah — pilih Opname.' },
      { to: '/stock/history', label: 'Riwayat', desc: 'Log seluruh pergerakan stok — filter, cari, hapus.' },
      { to: '/stock/product-stats', label: 'Analisa Produk', desc: 'Profitabilitas per produk: margin %, laba/unit, nilai stok.' },
    ],
  },
  {
    group: 'Piutang & Hutang',
    icon: CreditCard,
    items: [
      { to: '/stock/piutang', label: 'Piutang', desc: 'Tagihan ke pelanggan — pantau status lunas/belum/overdue.' },
      { to: '/stock/hutang', label: 'Hutang', desc: 'Hutang ke supplier — catat, bayar (partial/lunas), edit, hapus.' },
    ],
  },
  {
    group: 'Laporan',
    icon: BarChart3,
    items: [
      { to: '/stock/report', label: 'Laporan Stok', desc: 'Evaluasi stok: produk terlaris, slow mover, nilai per kategori.' },
      { to: '/stock/batch', label: 'Data Lengkap', desc: 'Semua data dalam satu layar: produk + summary + pergerakan.' },
    ],
  },
  {
    group: 'Lainnya',
    icon: Settings,
    items: [
      // { to: '/stock/notifications', label: 'Notifikasi', desc: 'Daftar alert stok menipis/habis yang perlu ditindaklanjuti.' },
      { to: '/stock/settings', label: 'Settings', desc: 'Atur channel penjualan aktif, lihat status akun & masa berlaku.' },
    ],
  },
];

export function StockBantuan() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Bantuan</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Panduan fitur dashboard Tata Business Suite
        </p>
      </div>

      {menuItems.map((group) => (
        <div key={group.group}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <group.icon size={20} />
            {group.group}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
            {group.items.map((item) => (
              <a
                key={item.to}
                href={item.to}
                className="card card-p"
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.25rem', transition: 'box-shadow 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className="card card-p" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <h4 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Butuh bantuan lebih lanjut?</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Hubungi admin atau kirim pesan ke bot WhatsApp untuk panduan lebih detail.
        </p>
      </div>
    </div>
  );
}
