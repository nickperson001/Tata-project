import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1rem',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      color: '#94a3b8', padding: '2rem',
    }}>
      <div style={{
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
        position: 'absolute', top: '-10%', right: '-5%', pointerEvents: 'none',
      }} />
      <div style={{
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        position: 'absolute', bottom: '-5%', left: '-5%', pointerEvents: 'none',
      }} />

      <img src="/stock/logo.svg" alt="Tata" style={{ height: 64, marginBottom: '0.25rem', position: 'relative' }} />
      <div style={{ fontSize: '5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1, position: 'relative' }}>404</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 600, position: 'relative' }}>Halaman tidak ditemukan</div>
      <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', position: 'relative' }}>
        Halaman yang Anda cari mungkin telah dipindahkan atau tidak tersedia.
      </div>
      <button
        onClick={() => navigate('/stock')}
        className="btn btn-ghost"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          color: '#10b981', fontSize: '0.875rem', fontWeight: 600,
          padding: '0.625rem 1.25rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)',
          background: 'rgba(16,185,129,0.08)', cursor: 'pointer', position: 'relative',
        }}
      >
        <ArrowLeft size={16} />
        Kembali ke Beranda
      </button>
    </div>
  );
}
