import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LogIn, Eye, EyeOff, LayoutDashboard, BarChart3, Users, Package } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, checkSession, login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }}>
        <div className="skel" style={{ width: 340, height: 400, borderRadius: 24 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a' }}>
      {/* ── Left Panel: Branding (hidden on mobile) ── */}
      <div className="login-brand" style={{
        flex: '0 0 480px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '3rem', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #065f46 100%)',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
          top: '-20%', right: '-20%',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
          bottom: '-15%', left: '-15%',
        }} />
        <div style={{
          position: 'absolute', width: 200, height: 200, borderRadius: '50%',
          border: '1px solid rgba(16,185,129,0.15)',
          top: '20%', right: '10%',
        }} />
        <div style={{
          position: 'absolute', width: 120, height: 120, borderRadius: '50%',
          border: '1px solid rgba(16,185,129,0.1)',
          bottom: '25%', right: '25%',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <img src="/stock/logo.svg" alt="Tata" style={{ height: 48 }} />
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.25rem' }}>Tata</div>
              <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>BUSINESS SUITE</div>
            </div>
          </div>

          <h1 style={{
            color: '#f1f5f9', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800,
            lineHeight: 1.2, marginBottom: '1rem',
          }}>
            Kelola bisnis Anda<br />
            <span style={{ color: '#10b981' }}>dalam satu platform</span>
          </h1>

          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 360, marginBottom: '2.5rem' }}>
            Pantau bisnis, catat transaksi, dan kembangkan usaha Anda dengan dashboard real-time dari WhatsApp.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { icon: Package, text: 'Manajemen bisnis & produk' },
              { icon: BarChart3, text: 'Laporan keuangan otomatis' },
              { icon: Users, text: 'Multi-user & hak akses' },
              { icon: LayoutDashboard, text: 'Dashboard real-time' },
            ].map((f) => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(16,185,129,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.icon size={16} style={{ color: '#10b981' }} />
                </div>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', position: 'relative',
      }}>
        {/* Decorative gradient dot */}
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        }} />

        <div className="login-card" style={{
          width: '100%', maxWidth: 400, position: 'relative',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          {/* Mobile brand (shown only on small screens) */}
          <div className="login-mobile-brand" style={{
            display: 'none', textAlign: 'center', marginBottom: '2rem',
          }}>
            <img src="/stock/logo.svg" alt="Tata" style={{ height: 40, marginBottom: '0.5rem' }} />
            <h1 style={{ color: '#f1f5f9', fontSize: '1.25rem', fontWeight: 800 }}>Tata Business Suite</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Admin Panel</p>
          </div>

          {/* Form header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Selamat datang kembali
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Masuk ke akun admin Anda
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, color: '#fca5a5', fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                EMAIL
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoFocus
                  style={{
                    background: '#1e293b', borderColor: '#334155', color: '#f1f5f9',
                    padding: '0.75rem 1rem', borderRadius: 12, fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#334155'}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    background: '#1e293b', borderColor: '#334155', color: '#f1f5f9',
                    padding: '0.75rem 1rem', paddingRight: '2.75rem',
                    borderRadius: 12, fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#334155'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', color: '#64748b', cursor: 'pointer',
                    padding: '0.25rem', display: 'flex',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email || !password}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem 1rem', marginTop: '0.5rem',
                background: submitting ? '#059669' : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)', transition: 'all 0.2s, transform 0.1s',
                opacity: (!email || !password) ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { if (!submitting && email && password) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              {submitting ? (
                <>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Memproses...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Masuk ke Admin
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center', color: '#475569', fontSize: '0.75rem',
            marginTop: '2rem',
          }}>
            &copy; {new Date().getFullYear()} Tata Business Suite
          </p>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 820px) {
          .login-brand { display: none !important; }
          .login-mobile-brand { display: block !important; }
        }
      `}</style>
    </div>
  );
}
