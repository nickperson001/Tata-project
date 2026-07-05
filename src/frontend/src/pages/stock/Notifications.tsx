import { useEffect, useState } from 'react';
import { stockApi } from '../../services/api';
import { useStockStore } from '../../store/stockStore';
import { useNotificationStore, StockAlert } from '../../store/notificationStore';
import { AlertTriangle, Package } from 'lucide-react';

export function Notifications() {
  const { token } = useStockStore();
  const { alerts, setAlerts } = useNotificationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    stockApi.get<{ alerts: StockAlert[] }>('/api/stock/alerts', token).then((res) => {
      if (res.alerts) {
        setAlerts(res.alerts);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token, setAlerts]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="skel" style={{ width: 300, height: '1rem', margin: '0 auto' }} />
      </div>
    );
  }

  const unresolved = alerts.filter((a) => !a.resolved_at);

  if (unresolved.length === 0) {
    return (
      <div className="card card-p" style={{ textAlign: 'center', padding: '3rem' }}>
        <Package size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '1rem' }} />
        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Semua Aman</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Tidak ada notifikasi stok yang perlu ditindaklanjuti
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
        Notifikasi ({unresolved.length})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {unresolved.map((alert) => (
          <div key={alert.id} className="card card-p" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            borderLeft: `4px solid ${alert.alert_type === 'out_of_stock' ? 'var(--danger)' : 'var(--warning)'}`,
          }}>
            <AlertTriangle size={20} style={{
              color: alert.alert_type === 'out_of_stock' ? 'var(--danger)' : 'var(--warning)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {alert.alert_type === 'out_of_stock' ? 'Stok Habis' : 'Stok Menipis'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                {alert.products?.name || `Produk #${alert.product_id}`} — Stok tersisa: {alert.stock_level} {alert.products?.unit || ''}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                {new Date(alert.alerted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
