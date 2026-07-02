import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { User, Shield, Download, Phone, Store, ShoppingBag, MessageCircle, Globe, Plus, Check, Trash2 } from 'lucide-react';
import { toast } from '../../components/Toast';
import { stockApi } from '../../services/api';

function formatWaNumber(id: string): string {
  const num = id.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
  if (num.length < 3) return id;
  const local = num.startsWith('62') ? '0' + num.slice(2) : num;
  const parts: string[] = [];
  let remaining = local;
  if (remaining.length > 3) { parts.push(remaining.slice(0, 4)); remaining = remaining.slice(4); }
  while (remaining.length > 0) { parts.push(remaining.slice(0, 4)); remaining = remaining.slice(4); }
  return parts.join('-');
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Built-in channel definitions
const CHANNEL_TEMPLATES = [
  { id: 'offline', name: 'Toko Offline', icon: Store, color: '#10b981', description: 'Penjualan langsung di toko fisik' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: '#25d366', description: 'Penjualan via chat WhatsApp' },
  { id: 'shopee', name: 'Shopee', icon: ShoppingBag, color: '#ee4d2d', description: 'Marketplace Shopee' },
  { id: 'tokopedia', name: 'Tokopedia', icon: ShoppingBag, color: '#42b549', description: 'Marketplace Tokopedia' },
  { id: 'lazada', name: 'Lazada', icon: ShoppingBag, color: '#0f146d', description: 'Marketplace Lazada' },
  { id: 'tiktok', name: 'TikTok Shop', icon: Globe, color: '#010101', description: 'TikTok Shop' },
];

export function StockSettings() {
  const { user, token } = useStockStore();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installChecked, setInstallChecked] = useState(false);

  // Sales channels state
  const [activeChannels, setActiveChannels] = useState<string[]>(['offline', 'whatsapp']);
  const [customChannelName, setCustomChannelName] = useState('');
  const [savingChannels, setSavingChannels] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setInstallChecked(true), 5000);
    const handler = (e: Event) => {
      e.preventDefault();
      clearTimeout(timeout);
      setInstallChecked(true);
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const onAppInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('appinstalled', onAppInstalled);
    if ((window.navigator as any).standalone === true) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onAppInstalled);
      clearTimeout(timeout);
    };
  }, []);

  // Load channels from user settings
  useEffect(() => {
    if (!token) return;
    stockApi.get<{ settings: any }>('/api/stock/settings', token)
      .then((d) => {
        if (d.settings?.active_channels) setActiveChannels(d.settings.active_channels);
      })
      .catch(() => {}); // silently fail, use defaults
  }, [token]);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') { setInstalled(true); setInstallPrompt(null); }
  }

  function toggleChannel(id: string) {
    setActiveChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  function addCustomChannel() {
    const name = customChannelName.trim();
    if (!name) return;
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    if (activeChannels.includes(id)) { toast.warning('Channel sudah ada'); return; }
    setActiveChannels(prev => [...prev, id]);
    setCustomChannelName('');
  }

  async function saveChannels() {
    if (!token) return;
    setSavingChannels(true);
    try {
      await stockApi.post('/api/stock/settings', token, { active_channels: activeChannels });
      toast.success('Channel penjualan berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan channel. Coba lagi.');
    } finally {
      setSavingChannels(false);
    }
  }

  const statusLabel: Record<string, string> = { demo: 'Demo', pro: 'PRO', unlimited: 'Unlimited' };
  const statusBadge: Record<string, string> = { demo: 'var(--warning)', pro: 'var(--primary)', unlimited: 'var(--secondary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 680 }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Pengaturan</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Informasi akun dan pengaturan aplikasi</p>
      </div>

      {/* Profil Akun */}
      {user && (
        <div className="card card-p" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} /> Profil Akun
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="sr" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <span className="lbl" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Nama Toko</span>
              <span className="val" style={{ fontWeight: 700 }}>{user.store_name}</span>
            </div>
            <div className="sr" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <span className="lbl" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Status Akun</span>
              <span className="val">
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.6rem',
                  borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                  background: statusBadge[user.status] || '#333', color: '#fff',
                }}>
                  <Shield size={12} />
                  {statusLabel[user.status] || user.status}
                </span>
              </span>
            </div>
            <div className="sr">
              <span className="lbl" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Phone size={12} /> Nomor WhatsApp
              </span>
              <span className="val" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{formatWaNumber(user.id)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Sales Channel / Multi-Platform ── */}
      <div className="card card-p" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Store size={18} /> Channel Penjualan
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Aktifkan platform tempat Anda berjualan. Setiap transaksi bisa ditandai per channel.
            </p>
          </div>
        </div>

        {/* Info box */}
        <div style={{
          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          💡 <strong style={{ color: 'var(--text)' }}>Multi-Channel Omnichannel:</strong> Stok tetap terpusat (satu gudang), namun setiap penjualan bisa diberi label channel. Laporan laba/rugi dan pergerakan stok bisa difilter per channel untuk mengetahui platform mana yang paling menguntungkan.
        </div>

        {/* Channel Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {CHANNEL_TEMPLATES.map(ch => {
            const isActive = activeChannels.includes(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => toggleChannel(ch.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem',
                  padding: '0.875rem 1rem', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: isActive ? `2px solid ${ch.color}` : '2px solid var(--border)',
                  background: isActive ? `${ch.color}12` : 'var(--bg)',
                  transition: 'all 0.15s', fontFamily: 'var(--font)',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%',
                    background: ch.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </span>
                )}
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ch.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ch.icon size={18} style={{ color: ch.color }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{ch.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{ch.description}</span>
              </button>
            );
          })}
        </div>

        {/* Custom channel */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            className="input input-sm"
            placeholder="Tambah channel kustom (misal: Grab Food)"
            value={customChannelName}
            onChange={e => setCustomChannelName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomChannel()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={addCustomChannel} disabled={!customChannelName.trim()}>
            <Plus size={14} /> Tambah
          </button>
        </div>

        {/* Custom channels list */}
        {activeChannels.filter(c => c.startsWith('custom_')).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {activeChannels.filter(c => c.startsWith('custom_')).map(c => (
              <span key={c} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.3rem 0.75rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
                background: 'var(--border)', color: 'var(--text)',
              }}>
                {c.replace('custom_', '').replace(/_/g, ' ')}
                <button
                  onClick={() => setActiveChannels(prev => prev.filter(x => x !== c))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={saveChannels}
          disabled={savingChannels}
          style={{ alignSelf: 'flex-start' }}
        >
          {savingChannels ? 'Menyimpan...' : <><Check size={16} /> Simpan Channel</>}
        </button>
      </div>

      {/* Aplikasi / PWA */}
      <div className="card card-p" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} /> Instal Aplikasi
        </h3>
        {installed ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Download size={32} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '0.5rem' }} />
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Aplikasi sudah terinstal ✓</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tata Business Suite siap digunakan dari layar utama.</p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Instal Tata Business Suite sebagai aplikasi di perangkat Anda untuk akses lebih cepat tanpa browser.
            </p>
            {installPrompt ? (
              <button className="btn btn-primary" onClick={handleInstall} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={18} /> Instal Aplikasi
              </button>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {installChecked
                  ? 'Buka melalui Chrome/Edge di HP atau desktop untuk menginstal.'
                  : 'Mengecek ketersediaan instalasi...'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
