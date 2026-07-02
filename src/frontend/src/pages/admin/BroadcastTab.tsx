import { useState, useEffect } from 'react';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import { toast } from '../../components/Toast';
import type { BroadcastProgress, BroadcastResult } from '../../types';
import { Send, Users } from 'lucide-react';

export function BroadcastTab() {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<BroadcastProgress | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('broadcast_progress', (data: BroadcastProgress) => {
      setProgress(data);
    });

    socket.on('broadcast_complete', (data: BroadcastResult) => {
      setProgress(null);
      setSending(false);
      setResult(data);
      toast(`Broadcast selesai: ${data.success} berhasil, ${data.failed} gagal`);
    });

    return () => {
      socket.off('broadcast_progress');
      socket.off('broadcast_complete');
    };
  }, []);

  async function sendBroadcast() {
    if (!message.trim()) return;
    setSending(true);
    setProgress(null);
    setResult(null);
    try {
      const res = await api.post<{ jobId?: string }>('/api/admin/broadcast', {
        message: message.trim(),
        target,
      });
      if (res.jobId) {
        toast('Broadcast sedang diproses...');
      }
    } catch (err: unknown) {
      setSending(false);
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim broadcast');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Broadcast</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Kirim pesan massal ke pengguna</p>
      </div>

      <div className="card card-p" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Target Penerima</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { value: 'all', label: 'Semua Pengguna' },
              { value: 'demo', label: 'Demo Only' },
              { value: 'pro', label: 'Pro Only' },
              { value: 'unlimited', label: 'Unlimited Only' },
            ].map((opt) => (
              <button
                key={opt.value}
                className={`btn btn-sm ${target === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTarget(opt.value)}
              >
                <Users size={14} /> {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Pesan</label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Gunakan {'{nama}'} untuk personalisasi nama toko
          </p>
          <textarea
            className="input"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tulis pesan broadcast di sini..."
            maxLength={5000}
          />
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {message.length}/5000
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={sendBroadcast}
          disabled={sending || !message.trim()}
          style={{ alignSelf: 'flex-start' }}
        >
          <Send size={16} />
          {sending ? 'Mengirim...' : 'Kirim Broadcast'}
        </button>

        {progress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="progress">
              <div
                className="progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {progress.current} / {progress.total} (gagal: {progress.failed})
            </div>
          </div>
        )}

        {result && (
          <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Broadcast Selesai</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {result.success} berhasil, {result.failed} gagal (total: {result.total})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
