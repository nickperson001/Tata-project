import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { FilterBar } from '../../components/FilterBar';
import type { DateRange } from '../../components/DateRangeFilter';
import { fmtRp } from '../../lib/utils';
import { EskalasiChart } from './EskalasiChart';
import { ExpenseChart } from './ExpenseChart';
import { toast } from '../../components/Toast';
import { TopProductsChart } from './TopProductsChart';
import type { SaldoData, OverviewData, ChannelProfit } from '../../types';
import { TrendingUp, AlertTriangle, Wallet, Users, Package, Percent, PieChart, BarChart, Bot, Globe, DollarSign, X } from 'lucide-react';

interface AlertItem {
  id: string;
  nama: string;
  type: 'stok_habis' | 'stok_menipis' | 'hutang_jatuh_tempo';
  detail: string;
  link?: string;
}

function ShimmerVal({ loading, width = '120px', height = '1.2rem', children, className }: { loading: boolean; width?: string; height?: string; children: React.ReactNode; className?: string }) {
  if (loading) return <Skeleton width={width} height={height} />;
  return <span {...(className ? { className } : {})}>{children}</span>;
}

function periodLabel(preset: string): string {
  switch (preset) {
    case 'today': return 'hari ini';
    case '7d': return '7 hari terakhir';
    case '30d': return '30 hari terakhir';
    default: return 'periode dipilih';
  }
}

function buildReport(o: OverviewData, storeName: string, preset: string): string[] {
  const margin = o.profit_margin.toFixed(1);
  const hppRatio = o.total_omzet > 0 ? ((o.total_hpp / o.total_omzet) * 100).toFixed(1) : '0.0';
  const expenseRatio = o.total_omzet > 0 ? ((o.total_pengeluaran / o.total_omzet) * 100).toFixed(1) : '0.0';
  const lines: string[] = [];

  lines.push(`• Omzet ${fmtRp(o.total_omzet)} dengan laba bersih ${o.laba_bersih >= 0 ? 'keuntungan' : 'kerugian'} ${fmtRp(Math.abs(o.laba_bersih))} (${periodLabel(preset)}).`);
  if (o.total_omzet > 0) {
    lines.push(`• Margin laba ${margin}%, dengan rasio HPP ${hppRatio}% dan biaya operasional ${expenseRatio}%.`);
  }
  lines.push(`• Nilai inventori ${fmtRp(o.nilai_inventori)}.`);
  if (o.stok_habis > 0 || o.stok_menipis > 0) {
    lines.push(`• Perhatian: ${o.stok_habis} produk habis dan ${o.stok_menipis} produk menipis.`);
  }
  if (o.piutang > 0) lines.push(`• Piutang beredar ${fmtRp(o.piutang)} — pastikan penagihan tepat waktu.`);

  if (o.laba_bersih >= 0) {
    lines.push(`✅ Bisnis Anda dalam kondisi menguntungkan. Pertahankan tren positif ini!`);
  } else {
    lines.push(`⚠️ Bisnis Anda mengalami defisit. Evaluasi harga jual dan efisiensi biaya.`);
  }
  return lines;
}

import { Z } from '../../lib/zIndex';

function AiWelcomePopup({ overview, storeName, preset, onClose }: { overview: OverviewData; storeName: string; preset: string; onClose: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const lines = buildReport(overview, storeName, preset);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setVisibleLines(0);
    timerRef.current = setInterval(() => {
      setVisibleLines(prev => {
        if (prev >= lines.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [overview, lines.length]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: Z.AI_POPUP,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        width: 'min(520px, 92vw)',
        maxHeight: '80vh',
        background: 'var(--bg-card)',
        borderRadius: 24,
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        animation: 'scaleIn 0.3s ease-out',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 100%)',
          borderBottom: '1px solid rgba(16,185,129,0.15)',
          padding: '1.5rem 1.75rem 1rem',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            className="ai-popup-close"
            style={{
              position: 'absolute', right: 14, top: 14,
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: 'rgba(0,0,0,0.06)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', transition: 'all 0.2s',
            }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="ai-sparkle-icon" style={{
              width: 48, height: 48, borderRadius: 16,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(16,185,129,0.35)',
              flexShrink: 0,
            }}>
              <Bot size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                Halo {storeName}! ✨
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500, marginTop: 2 }}>
                Analisis AI • {periodLabel(preset)}
              </div>
            </div>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '0.3rem 0.7rem',
              borderRadius: 10, whiteSpace: 'nowrap',
              background: overview.laba_bersih >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
              color: overview.laba_bersih >= 0 ? '#059669' : '#dc2626',
            }}>
              {overview.laba_bersih >= 0 ? 'Bisnis Sehat' : 'Perlu Evaluasi'}
            </span>
          </div>
        </div>
        <div style={{ padding: '1.25rem 1.75rem 1.75rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {lines.map((line, i) => (
              <div key={i} style={{
                fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--text)',
                opacity: i < visibleLines ? 1 : 0,
                transform: i < visibleLines ? 'translateY(0)' : 'translateY(10px)',
                transition: 'all 0.45s ease-out',
                padding: '0.35rem 0.75rem',
                borderRadius: 10,
                background: i < visibleLines ? 'rgba(16,185,129,0.04)' : 'transparent',
              }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '1.25rem', padding: '0.75rem 1rem',
            background: 'rgba(16,185,129,0.06)',
            borderRadius: 12, border: '1px solid rgba(16,185,129,0.15)',
            fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center',
          }}>
            💡 Data diperbarui otomatis setiap 30 detik
          </div>
        </div>
      </div>
    </div>
  );
}

export function StockOverview() {
  const { token, user } = useStockStore();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [chartDays, setChartDays] = useState(30);
  const [filterChannel, setFilterChannel] = useState('');
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, preset: 'today' });
  const [showAiPopup, setShowAiPopup] = useState(() => !sessionStorage.getItem('tbs_ai_popup_shown'));

  const periodParam = dateRange.preset === 'today' ? 'day' : dateRange.preset === '7d' ? 'week' : 'month';
  let overviewUrl = `/api/stock/overview?period=${periodParam}&channel=${filterChannel}`;
  if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
    overviewUrl = `/api/stock/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&channel=${filterChannel}`;
  }

  const sharedOpts = { enabled: !!token, staleTime: 30_000, refetchInterval: (q: any) => q.state.status === 'success' ? 30_000 : false, refetchIntervalInBackground: false };

  const saldoQuery = useQuery({ queryKey: ['saldo', token], queryFn: () => stockApi.get<SaldoData>('/api/stock/saldo', token!), ...sharedOpts });
  const overviewQuery = useQuery({ queryKey: ['overview', token, overviewUrl], queryFn: () => stockApi.get<OverviewData>(overviewUrl, token!), ...sharedOpts });
  const hutangQuery = useQuery({ queryKey: ['hutang-unpaid', token], queryFn: () => stockApi.get<{ list: { nama_supplier: string; jatuh_tempo: string | null; nominal_hutang: number; jumlah_dibayar: number }[] }>('/api/stock/hutang?status=unpaid', token!), ...sharedOpts });
  const chartQuery = useQuery({ queryKey: ['dashboard-charts', token, chartDays], queryFn: () => stockApi.get<any>(`/api/stock/dashboard/charts?days=${chartDays}`, token!), ...sharedOpts });
  const channelProfitQuery = useQuery({ queryKey: ['channel-profitability', token], queryFn: () => stockApi.get<ChannelProfit[]>('/api/stock/channel-profitability', token!), ...sharedOpts });
  const settingsQuery = useQuery({ queryKey: ['settings', token], queryFn: () => stockApi.get<{ settings: any }>('/api/stock/settings', token!), enabled: !!token, staleTime: 60_000 });

  useEffect(() => {
    if (settingsQuery.data?.settings?.active_channels) setActiveChannels(settingsQuery.data.settings.active_channels);
  }, [settingsQuery.data]);

  const loading = saldoQuery.isPending || overviewQuery.isPending || hutangQuery.isPending || chartQuery.isPending || channelProfitQuery.isPending;
  const saldo = saldoQuery.data ?? null;
  const overview = overviewQuery.data ?? null;
  const chartData = chartQuery.data ?? null;
  const channelProfit = channelProfitQuery.data ?? [];

  useEffect(() => {
    const o = overviewQuery.data;
    const h = hutangQuery.data;
    if (!o) return;
    const a: AlertItem[] = [];
    if (o.stok_habis > 0) a.push({ id: 'out', nama: 'Stok Habis', type: 'stok_habis', detail: `${o.stok_habis} produk habis`, link: '/stock/products' });
    if (o.stok_menipis > 0) a.push({ id: 'low', nama: 'Stok Menipis', type: 'stok_menipis', detail: `${o.stok_menipis} produk menipis`, link: '/stock/products' });
    if (h) {
      const overdueHutang = h.list.filter(item => item.jatuh_tempo && new Date(item.jatuh_tempo) < new Date());
      overdueHutang.forEach(item => {
        a.push({
          id: `hutang_${item.nama_supplier}`,
          nama: item.nama_supplier,
          type: 'hutang_jatuh_tempo',
          detail: `Hutang ${fmtRp(item.nominal_hutang - item.jumlah_dibayar)} sudah jatuh tempo`,
          link: '/stock/hutang',
        });
      });
    }
    setAlerts(a);
  }, [overviewQuery.data, hutangQuery.data]);

  const hppRatio = overview && overview.total_omzet > 0 ? (overview.total_hpp / overview.total_omzet * 100) : 0;
  const expenseRatio = overview && overview.total_omzet > 0 ? (overview.total_pengeluaran / overview.total_omzet * 100) : 0;
  const habisPct = overview && overview.total_product > 0 ? (overview.stok_habis / overview.total_product * 100) : 0;
  const menipisPct = overview && overview.total_product > 0 ? (overview.stok_menipis / overview.total_product * 100) : 0;
  const piutangRatio = overview && overview.total_omzet > 0 ? (overview.piutang / overview.total_omzet * 100) : 0;

  return (
    <div className="ov-page">
      {user?.status === 'demo' && (
        <div className="card card-p data-enter" style={{
          background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
          border: 'none', borderRadius: 16, marginBottom: '1.5rem',
          color: '#fff', padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            🔒 Anda menggunakan mode Demo. Upgrade ke PRO untuk akses laporan keuangan, piutang, hutang, dan produk tak terbatas.
          </span>
          <a
            href="https://wa.me/6283121376756?text=Halo%20saya%20ingin%20upgrade%20Tata%20Business%20Suite%20ke%20PRO"
            target="_blank" rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: '2px solid rgba(255,255,255,0.5)', borderRadius: 10,
              padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem',
              cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Upgrade Sekarang
          </a>
        </div>
      )}

      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showChannel
        channel={filterChannel}
        onChannelChange={setFilterChannel}
        channels={activeChannels}
        showSearch={false}
      />

      {!showAiPopup && overview && (
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            sessionStorage.removeItem('tbs_ai_popup_shown');
            setShowAiPopup(true);
          }}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            borderRadius: 12, padding: '0.5rem 1rem',
          }}
        >
          <Bot size={16} />
          Lihat Analisis
        </button>
      )}

      {/* Bento Grid Layout (Saldo, Stats) */}
      <div className="bento-grid">
        <div className="bento-card bento-saldo" style={{ transition: 'opacity 0.3s' }}>
          <div>
            <div className="ov-hero-label">Saldo Kas</div>
            <div className={`ov-hero-number ${saldo ? 'data-enter' : ''}`}>
              <ShimmerVal loading={loading} width="180px" height="2.5rem">
                {fmtRp(saldo?.saldo || 0)}
              </ShimmerVal>
            </div>
            <div className="ov-hero-stats">
              <span>Masuk <strong className={saldo ? 'data-enter' : ''}><ShimmerVal loading={loading} width="100px" height="1rem">{fmtRp(saldo?.totalMasuk || 0)}</ShimmerVal></strong></span>
              <span>Keluar <strong className={saldo ? 'data-enter' : ''}><ShimmerVal loading={loading} width="100px" height="1rem">{fmtRp(saldo?.totalKeluar || 0)}</ShimmerVal></strong></span>
            </div>
          </div>
          <Wallet size={64} className="ov-hero-icon" style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: saldo ? 0.15 : 0.05, transition: 'opacity 0.3s' }} />
        </div>

        <div className={`bento-card bento-stat1 ${overview ? 'data-enter' : ''}`} onClick={() => navigate('/stock/keuangan')} style={{ cursor: 'pointer', animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="ov-stat-icon-row" style={{ color: (overview?.laba_bersih || 0) >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
              <TrendingUp size={16} /> Laba Bersih
            </div>
            <div className={`kpi-mini-chart ${(overview?.laba_bersih || 0) >= 0 ? 'kpi-up' : 'kpi-down'}`}>
              {(overview?.laba_bersih || 0) >= 0 ? '📈' : '📉'} {overview?.profit_margin.toFixed(1) || '0'}%
            </div>
          </div>
          <div className="ov-stat-value" style={{ color: (overview?.laba_bersih || 0) >= 0 ? 'var(--primary)' : 'var(--danger)', marginTop: 'auto', paddingTop: '1rem' }}>
            <ShimmerVal loading={loading} width="140px" height="1.4rem">{fmtRp(overview?.laba_bersih || 0)}</ShimmerVal>
          </div>
        </div>

        <div className={`bento-card bento-stat2 ${overview ? 'data-enter' : ''}`} onClick={() => navigate('/stock/keuangan')} style={{ cursor: 'pointer', animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="ov-stat-icon-row" style={{ color: 'var(--primary)' }}>
              <Wallet size={16} /> Pendapatan
            </div>
            <div className="kpi-mini-chart kpi-up">💰 KAS</div>
          </div>
          <div className="ov-stat-value" style={{ color: 'var(--primary)', marginTop: 'auto', paddingTop: '1rem' }}>
            <ShimmerVal loading={loading} width="140px" height="1.4rem">{fmtRp(overview?.total_omzet || 0)}</ShimmerVal>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="ov-kpi-grid" style={{ opacity: overview ? 1 : 0.5, transition: 'opacity 0.3s' }}>
        {[
          { icon: Percent, label: 'Margin Laba', value: overview?.profit_margin.toFixed(1) || '0', unit: '%', color: (overview?.laba_bersih || 0) >= 0 ? 'var(--primary)' : 'var(--danger)' },
          { icon: BarChart, label: 'Rasio HPP', value: hppRatio.toFixed(1), unit: '%', color: 'var(--warning)' },
          { icon: PieChart, label: 'Rasio Biaya', value: expenseRatio.toFixed(1), unit: '%', color: 'var(--danger)' },
          { icon: Package, label: 'Stok Habis', value: habisPct.toFixed(1), unit: '%', color: habisPct > 0 ? 'var(--danger)' : 'var(--text-muted)' },
          { icon: AlertTriangle, label: 'Stok Menipis', value: menipisPct.toFixed(1), unit: '%', color: menipisPct > 0 ? 'var(--warning)' : 'var(--text-muted)' },
          { icon: DollarSign, label: 'Nilai Inventori', value: overview ? fmtRp(overview.nilai_inventori) : '0', unit: '', color: 'var(--primary)' },
          { icon: Users, label: 'Piutang vs Omzet', value: piutangRatio.toFixed(1), unit: '%', color: piutangRatio > 10 ? 'var(--warning)' : 'var(--text-muted)' },
        ].map((kpi, i) => (
          <div key={kpi.label} className={`ov-kpi-card ${overview ? 'data-enter' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <kpi.icon size={14} className="ov-kpi-icon" />
            <div className="ov-kpi-label">{kpi.label}</div>
            <div className="ov-kpi-value" style={{ color: kpi.color }}>
              <ShimmerVal loading={loading} width="70px" height="1rem">{kpi.value}</ShimmerVal>
              <span className="ov-kpi-unit">{kpi.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Channel Profitability */}
      {(loading || channelProfit.length > 0) && (
      <div className="card card-p">
        <div className="ov-section-title">
          <Globe size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Profitability per Channel
        </div>
        <div className="ov-channels-grid">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ov-channel-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="ov-channel-header">
                  <Skeleton width="80px" height="0.8rem" />
                  <Skeleton width="40px" height="0.8rem" />
                </div>
                <Skeleton width="120px" height="1rem" />
                <div className="ov-channel-detail" style={{ marginTop: 4 }}>
                  <Skeleton width="100px" height="0.75rem" />
                </div>
                <div className="progress-bar" style={{ marginTop: 6 }}><Skeleton width="100%" height="6px" /></div>
              </div>
            ))
          ) : channelProfit.map(ch => (
            <div key={ch.channel} className="ov-channel-card data-enter">
              <div className="ov-channel-header">
                <span className="ov-channel-name">{ch.channel}</span>
                <span className="ov-channel-margin" style={{ color: ch.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                  {ch.margin}%
                </span>
              </div>
              <div className="ov-channel-revenue">{fmtRp(ch.revenue)}</div>
              <div className="ov-channel-detail">
                <span>HPP: {fmtRp(ch.hpp)}</span>
                <span style={{ color: ch.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 600 }}>
                  {ch.netProfit >= 0 ? '+' : ''}{fmtRp(ch.netProfit)}
                </span>
              </div>
              <div className="progress-bar" style={{ marginTop: 6 }}>
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, ch.revenue / Math.max(...channelProfit.map(c => c.revenue)) * 100)}%`,
                  background: ch.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)',
                  opacity: 0.6,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Ringkasan Laba Rugi */}
      {overview && (overview.total_omzet > 0 || overview.total_hpp > 0) && (
        <div className="card card-p ov-labarugi data-enter">
          <div className="ov-section-title">Ringkasan Laba Rugi</div>
          <div className="ov-labarugi-bars">
            <div>
              <div className="ov-bar-label">
                <span>Pendapatan</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmtRp(overview.total_omzet)}</span>
              </div>
              <div className="progress-bar"><div className="progress-bar-fill" style={{ width: '100%', background: 'var(--primary)' }} /></div>
            </div>
            <div>
              <div className="ov-bar-label">
                <span>HPP (Modal Barang)</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{fmtRp(overview.total_hpp)}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${overview.total_omzet > 0 ? (overview.total_hpp / overview.total_omzet * 100) : 0}%`,
                  background: 'var(--warning)',
                }} />
              </div>
            </div>
            <div className="ov-bar-divider" />
            <div>
              <div className="ov-bar-label">
                <span style={{ fontWeight: 600 }}>Laba Bersih</span>
                <span style={{ fontWeight: 800, color: overview.laba_bersih >= 0 ? 'var(--primary)' : 'var(--danger)' }}>{fmtRp(overview.laba_bersih)}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${overview.total_omzet > 0 ? (Math.abs(overview.laba_bersih) / overview.total_omzet * 100) : 0}%`,
                  background: overview.laba_bersih >= 0 ? 'var(--primary)' : 'var(--danger)',
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="ov-charts">
          <div className="card card-p ov-chart-main" style={{ padding: '1.25rem' }}>
            <Skeleton width="200px" height="1rem" />
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', height: 180 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} width="100%" height={`${40 + Math.random() * 100}px`} />
              ))}
            </div>
          </div>
          <div className="ov-chart-row">
            <div className="card card-p" style={{ padding: '1.25rem' }}>
              <Skeleton width="140px" height="1rem" />
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: 140 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} width="100%" height={`${30 + Math.random() * 80}px`} />
                ))}
              </div>
            </div>
            <div className="card card-p" style={{ padding: '1.25rem' }}>
              <Skeleton width="140px" height="1rem" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: 8 }}>
                  <Skeleton width="24px" height="24px" />
                  <Skeleton width="60%" height="0.8rem" />
                  <Skeleton width="60px" height="0.8rem" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : chartData && (
        <div className="ov-charts">
          <div className="card card-p ov-chart-main">
            <div className="ov-chart-header">
              <div className="ov-section-title">Eskalasi Revenue vs Expense</div>
              <div className="period-bar">
                {[7, 30, 90].map(d => (
                  <button key={d} className={`period-btn ${chartDays === d ? 'active' : ''}`} onClick={() => setChartDays(d)}>{d}H</button>
                ))}
              </div>
            </div>
            <EskalasiChart labels={chartData.labels} revenue={chartData.revenue} expense={chartData.expense} />
          </div>
          <div className="ov-chart-row">
            <div className="card card-p" style={{ padding: '1.25rem' }}>
              <div className="ov-section-title" style={{ marginBottom: '0.75rem' }}>Pengeluaran</div>
              <ExpenseChart labels={chartData.expenseLabels} values={chartData.expenseValues} />
            </div>
            <div className="card card-p" style={{ padding: '1.25rem' }}>
              <div className="ov-section-title" style={{ marginBottom: '0.75rem' }}>Produk Terlaris</div>
              <TopProductsChart products={chartData.topProducts} />
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <div className="ov-section-title" style={{ marginBottom: '0.5rem' }}>Perlu Perhatian</div>
          {alerts.map((alert, i) => (
            <div key={alert.id} className={`ov-alert-item ${alert.type} data-enter`} style={{ animationDelay: `${i * 0.1}s` }} onClick={() => alert.link && navigate(alert.link)}>
              <AlertTriangle size={16} className="ov-alert-icon" />
              <div>
                <div className="ov-alert-name">{alert.nama}</div>
                <div className="ov-alert-detail">{alert.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && !saldo && !overview && (
        saldoQuery.isError || overviewQuery.isError ? (
          <div className="card card-p ov-empty data-enter" style={{ borderColor: 'var(--danger)', borderWidth: 2 }}>
            <div className="ov-empty-icon" style={{ fontSize: '2.5rem' }}>⚠️</div>
            <div className="ov-empty-title">Gagal Memuat Data</div>
            <p className="ov-empty-desc" style={{ maxWidth: 400, margin: '0 auto' }}>
              Server penyimpanan data (Supabase) sedang tidak dapat dijangkau. 
              Silakan coba lagi beberapa saat.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                saldoQuery.refetch();
                overviewQuery.refetch();
              }}
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="card card-p ov-empty data-enter">
            <div className="ov-empty-icon">📊</div>
            <div className="ov-empty-title">Selamat Datang di Dashboard</div>
            <p className="ov-empty-desc">Mulai dengan menambahkan produk dan mencatat transaksi pertama Anda.</p>
          </div>
        )
      )}

      {showAiPopup && overview && (
        <AiWelcomePopup
          overview={overview}
          storeName={user?.store_name || 'Owner'}
          preset={dateRange.preset}
          onClose={() => {
            setShowAiPopup(false);
            sessionStorage.setItem('tbs_ai_popup_shown', '1');
          }}
        />
      )}
    </div>
  );
}
