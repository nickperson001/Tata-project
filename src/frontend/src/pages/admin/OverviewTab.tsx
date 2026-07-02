import { useEffect, useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { StatCard } from '../../components/StatCard';
import { Skeleton } from '../../components/LoadingSkeleton';
import { toast } from '../../components/Toast';
import type { HealthResponse, BotState } from '../../types';
import { Wifi, WifiOff, RefreshCw, RotateCcw, Database, Activity, Send, FlaskConical, Smartphone } from 'lucide-react';

export function OverviewTab() {
  const { botState, setBotState } = useAdminStore();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  useEffect(() => {
    api.get<HealthResponse>('/health')
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false));
  }, []);

  useEffect(() => {
    api.get<BotState>('/api/admin/status')
      .then((data) => {
        if (data) setBotState(data);
      })
      .catch(() => {});
  }, [setBotState]);

  useEffect(() => {
    const socket = getSocket();
    socket.on('bot_update', (data: BotState) => setBotState(data));
    return () => { socket.off('bot_update'); };
  }, [setBotState]);

  useEffect(() => {
    if (botState?.currentQR && !botState.pairingCode) {
      api.get<{ pairingCode: string }>('/api/admin/qr-image')
        .then((data) => {
          if (data?.pairingCode) {
            setBotState({ ...botState, pairingCode: data.pairingCode });
          }
        })
        .catch(() => {});
    }
  }, [botState?.currentQR, botState?.pairingCode]);

  function reconnectWA() {
    getSocket().emit('request_reconnect');
    toast('Meminta koneksi ulang WA...');
  }

  async function requestPairingCode() {
    const phone = pairingPhone.replace(/[^0-9]/g, '');
    if (!phone) { toast.error('Masukkan nomor telepon'); return; }
    setPairingLoading(true);
    try {
      const res = await api.post<{ success: boolean; code: string }>('/api/admin/pairing-code', { phoneNumber: phone });
      if (res.success) {
        toast.success(`Kode pairing: ${res.code}`);
        setPairingPhone('');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal minta kode pairing');
    } finally {
      setPairingLoading(false);
    }
  }

  function toggleMaintenance() {
    api.post('/api/admin/maintenance', { enabled: !botState?.maintenanceMode })
      .then(() => toast('Mode maintenance diubah'))
      .catch((err) => toast.error(err.message));
  }

  async function seedDemo() {
    setSeeding(true);
    try {
      const res = await api.post<{ success: boolean; log: string[] }>('/api/admin/seed-demo');
      if (res.success) {
        toast.success('Demo data berhasil di-seed!');
        const urlLine = res.log.find(l => l.includes('/stock/'));
        if (urlLine) {
          const url = urlLine.trim();
          toast.success(`URL: ${url}`, { duration: 8000 });
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal seed demo');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Command Center Tata Business Suite</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-4" style={{ gap: '1rem' }}>
        <StatCard
          label="Status Sistem"
          value={healthLoading ? <Skeleton width="80%" /> : (health?.status === 'healthy' ? 'Sehat' : 'Degradasi')}
          icon={<Activity size={24} />}
        />
        <StatCard
          label="Total Pengguna"
          value="—"
          icon={<Database size={24} />}
        />
        <StatCard
          label="Memory"
          value={healthLoading ? <Skeleton width="60%" /> : health ? `${health.system.memory.percentage}%` : '—'}
          icon={<Database size={24} />}
        />
        <StatCard
          label="WhatsApp"
          value={botState?.clientReady ? 'Terhubung' : (botState?.botStatus || 'Memuat...')}
          icon={botState?.clientReady ? <Wifi size={24} style={{ color: 'var(--primary)' }} /> : <WifiOff size={24} style={{ color: 'var(--danger)' }} />}
        />
      </div>

      {/* WhatsApp Connection */}
      <div className="card card-p" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Koneksi WhatsApp</h3>
        {botState?.clientReady ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-sm)' }}>
            <Wifi size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>WhatsApp Terhubung</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bot siap menerima pesan</div>
            </div>
          </div>
        ) : botState?.currentQR ? (
          <div className="qr-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
            {botState.pairingCode ? (
              <img
                src={botState.pairingCode}
                alt="QR Code"
                style={{ width: 200, height: 200, borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}
              />
            ) : (
              <div style={{ width: 200, height: 200, borderRadius: 'var(--radius)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Memuat QR...
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scan QR ini dengan WhatsApp Anda</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: 320 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>— atau gunakan kode pairing —</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Nomor telepon (628xx)"
                  value={pairingPhone}
                  onChange={(e) => setPairingPhone(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') requestPairingCode(); }}
                />
                <button className="btn btn-primary btn-sm" onClick={requestPairingCode} disabled={pairingLoading}>
                  <Smartphone size={16} /> {pairingLoading ? 'Memproses...' : 'Pairing'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
            <WifiOff size={24} style={{ color: 'var(--danger)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--danger)' }}>WhatsApp Terputus</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {botState?.botStatus || 'Memuat...'}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-sm" onClick={reconnectWA}>
            <RefreshCw size={16} /> Hubungkan Ulang
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => getSocket().emit('session_reset')}>
            <RotateCcw size={16} /> Reset Sesi
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-2" style={{ gap: '1rem' }}>
        <div className="card card-p" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Send size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontWeight: 700 }}>Broadcast</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kirim pesan broadcast ke pengguna</p>
          <a href="/broadcast" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Buka Broadcast</a>
        </div>
        <div className="card card-p" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontWeight: 700 }}>Maintenance</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Status: {botState?.maintenanceMode ? 'Aktif' : 'Nonaktif'}
          </p>
          <button className={`btn btn-sm ${botState?.maintenanceMode ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleMaintenance} style={{ alignSelf: 'flex-start' }}>
            {botState?.maintenanceMode ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
        <div className="card card-p" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FlaskConical size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontWeight: 700 }}>Demo Data</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Buat user dummy + data contoh untuk stock dashboard
          </p>
          <button className="btn btn-primary btn-sm" onClick={seedDemo} disabled={seeding} style={{ alignSelf: 'flex-start' }}>
            {seeding ? 'Memproses...' : 'Seed Demo'}
          </button>
        </div>
      </div>
    </div>
  );
}
