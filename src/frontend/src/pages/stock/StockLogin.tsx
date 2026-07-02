import { useState, type FormEvent } from 'react';
import { useStockStore } from '../../store/stockStore';
import { LogIn, Phone, LayoutDashboard, BarChart3, Users, Package, MessageCircle, AlertCircle, Play } from 'lucide-react';

export function StockLogin() {
  const [wa, setWa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const { setToken, setUser } = useStockStore();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wa.trim()) return;
    setError('');
    setErrorCode('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock/auth/wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: wa.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login gagal');
        setErrorCode(data.code || '');
        return;
      }
      localStorage.setItem('tbs_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemo() {
    setError('');
    setErrorCode('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock/demo/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal setup demo'); return; }
      // Verify the user to get full user object
      const verifyRes = await fetch(`/api/stock/verify?token=${data.token}`);
      if (!verifyRes.ok) { setError('Gagal verifikasi demo'); return; }
      const userData = await verifyRes.json();
      localStorage.setItem('tbs_token', data.token);
      setToken(data.token);
      setUser(userData);
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a' }}>
      {/* ── Left Panel: Branding ── */}
      <div className="login-brand" style={{
        flex: '0 0 480px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '3rem', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #065f46 100%)',
      }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', top: '-20%', right: '-20%' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', bottom: '-15%', left: '-15%' }} />
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(16,185,129,0.15)', top: '20%', right: '10%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <img src="/stock/logo.svg" alt="Tata" style={{ height: 40 }} />
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.25rem' }}>Tata</div>
              <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>BUSINESS SUITE</div>
            </div>
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
            Kelola bisnis Anda<br /><span style={{ color: '#10b981' }}>dalam satu platform</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 360, marginBottom: '2.5rem' }}>
             Pantau bisnis, catat transaksi, dan kembangkan usaha Anda dengan analisis keuangan real-time.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { icon: Package, text: 'Manajemen bisnis & produk' },
              { icon: BarChart3, text: 'Laporan keuangan otomatis' },
              { icon: Users, text: 'Multi-user & hak akses' },
              { icon: LayoutDashboard, text: 'Dashboard analisis real-time' },
            ].map((f) => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={16} style={{ color: '#10b981' }} />
                </div>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

        <div className="login-card" style={{ width: '100%', maxWidth: 400, position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
          {/* Mobile brand */}
          <div className="login-mobile-brand" style={{ display: 'none', textAlign: 'center', marginBottom: '2rem' }}>
            <img src="/stock/logo.svg" alt="Tata" style={{ height: 40, marginBottom: '0.5rem' }} />
            <h1 style={{ color: '#f1f5f9', fontSize: '1.25rem', fontWeight: 800 }}>Tata Business Suite</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Dashboard Owner</p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Selamat datang kembali
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Masuk dengan nomor WhatsApp terdaftar
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem',
              background: errorCode === 'NOT_REGISTERED' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${errorCode === 'NOT_REGISTERED' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.25)'}`,
              borderRadius: 12, marginBottom: '1.25rem',
            }}>
              <AlertCircle size={18} style={{ color: errorCode === 'NOT_REGISTERED' ? '#f59e0b' : '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ color: errorCode === 'NOT_REGISTERED' ? '#fcd34d' : '#fca5a5', fontSize: '0.85rem', lineHeight: 1.5 }}>{error}</p>
                {errorCode === 'NOT_REGISTERED' && (
                  <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.5rem' }}>
                    💬 Kirim pesan <strong style={{ color: '#10b981' }}>"Daftar"</strong> ke nomor bot WhatsApp Tata untuk mendaftar gratis.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  NOMOR WHATSAPP
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type="tel"
                    value={wa}
                    onChange={(e) => setWa(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    required
                    autoFocus
                    style={{
                      background: '#1e293b', borderColor: '#334155', color: '#f1f5f9',
                      padding: '0.75rem 1rem', paddingLeft: '2.75rem', borderRadius: 12,
                      fontSize: '0.9rem', transition: 'all 0.2s', width: '100%',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                  />
                  <Phone size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !wa.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.75rem 1rem', marginTop: '0.5rem',
                  background: submitting ? '#059669' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)', transition: 'all 0.2s, transform 0.1s',
                  opacity: (!wa.trim()) ? 0.6 : 1, width: '100%',
                }}
                onMouseEnter={(e) => { if (!submitting && wa.trim()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
              >
              {submitting ? (
                <>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                  Memproses...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Masuk ke Dashboard
                </>
              )}
            </button>
          </form>

          {/* Register hint */}
          <div style={{
            marginTop: '1.75rem', padding: '1rem 1.25rem',
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <MessageCircle size={16} style={{ color: '#10b981' }} />
              <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>Belum punya akun?</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.5 }}>
              Kirim pesan <strong style={{ color: '#94a3b8' }}>"Daftar"</strong> ke nomor <strong style={{ color: '#10b981' }}>+62 831-2137-6756</strong> untuk registrasi gratis. Setelah terdaftar, kembali ke halaman ini dan masukkan nomor WA Anda.
            </p>
          </div>

          {/* Demo Login */}
          <div style={{
            marginTop: '1rem', padding: '1rem 1.25rem',
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Play size={16} style={{ color: '#3b82f6' }} />
              <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.85rem' }}>Coba tanpa daftar</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              Lihat demo dashboard dengan data contoh untuk mengeksplorasi fitur.
            </p>
            <button
              type="button"
              onClick={handleDemo}
              disabled={submitting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.6rem 1rem', width: '100%',
                background: submitting ? '#1e3a5f' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: '0.85rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', transition: 'all 0.2s, transform 0.1s',
              }}
              onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <Play size={15} />
              Masuk Demo
            </button>
          </div>

          <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.75rem', marginTop: '1.5rem' }}>
            &copy; {new Date().getFullYear()} Tata Business Suite
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 820px) {
          .login-brand { display: none !important; }
          .login-mobile-brand { display: block !important; }
        }
      `}</style>
    </div>
  );
}
