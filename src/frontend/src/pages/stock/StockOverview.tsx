import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { FilterBar, type DateRange } from '../../components/FilterBar';
import { fmtRp } from '../../lib/utils';
import { EskalasiChart } from './EskalasiChart';
import { ExpenseChart } from './ExpenseChart';
import { TopProductsChart } from './TopProductsChart';
import type { SaldoData, OverviewData, ChannelProfit } from '../../types';
import { TrendingUp, AlertTriangle, Wallet, Users, Package, Percent, PieChart, BarChart, Bot, Globe } from 'lucide-react';

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

function AIAnalysis({ overview, storeName, preset }: { overview: OverviewData; storeName: string; preset: string }) {
  const [currentLine, setCurrentLine] = useState(0);
  const lines = buildReport(overview, storeName, preset);

  useEffect(() => {
    setCurrentLine(0);
    const timer = setInterval(() => {
      setCurrentLine(prev => {
        if (prev >= lines.length) { clearInterval(timer); return prev; }
        return prev + 1;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [overview]);

  return (
    <div className="data-enter" style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
      borderRadius: 16, padding: '1.25rem 1.5rem',
      border: '1px solid rgba(16,185,129,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#065f46' }}>
            Halo {storeName}! 👋 Saya Asisten Tata
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Analisis {periodLabel(preset)}
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981', marginLeft: 6, animation: 'pulse 2s infinite' }} />
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem',
            borderRadius: 6, background: overview.laba_bersih >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
            color: overview.laba_bersih >= 0 ? '#059669' : '#dc2626',
          }}>
            {overview.laba_bersih >= 0 ? 'Menguntungkan' : 'Defisit'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {lines.slice(0, currentLine).map((line, i) => (
          <div key={i} style={{
            fontSize: '0.88rem', lineHeight: 1.6, color: '#374151',
            padding: '0.25rem 0', borderBottom: i < lines.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
          }}>
            {line}
          </div>
        ))}
        {currentLine < lines.length && (
          <span style={{ display: 'inline-block', width: 8, height: 16, background: '#10b981', animation: 'blink 1s step-end infinite' }} />
        )}
      </div>
    </div>
  );
}

function AIAnalysisSkeleton() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
      borderRadius: 16, padding: '1.25rem 1.5rem',
      border: '1px solid rgba(16,185,129,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Skeleton width="40px" height="40px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="200px" height="1.1rem" />
          <div style={{ marginTop: 4 }}><Skeleton width="140px" height="0.75rem" /></div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Skeleton width="100%" height="0.88rem" />
        <Skeleton width="85%" height="0.88rem" />
        <Skeleton width="70%" height="0.88rem" />
        <Skeleton width="90%" height="0.88rem" />
      </div>
    </div>
  );
}

export function StockOverview() {
  const { token, user } = useStockStore();
  const navigate = useNavigate();
  const [saldo, setSaldo] = useState<SaldoData | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [chartData, setChartData] = useState<{
    labels: string[];
    revenue: number[];
    expense: number[];
    expenseLabels: string[];
    expenseValues: number[];
    topProducts: { name: string; revenue: number; qty: number }[];
  } | null>(null);
  const [chartDays, setChartDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState('');
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, preset: 'today' });
  const [channelProfit, setChannelProfit] = useState<ChannelProfit[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      let periodParam = 'month';
      if (dateRange.preset === 'today') periodParam = 'day';
      else if (dateRange.preset === '7d') periodParam = 'week';
      let overviewUrl = `/api/stock/overview?period=${periodParam}&channel=${filterChannel}`;
      if (dateRange.preset === 'custom' && dateRange.startDate && dateRange.endDate) {
        overviewUrl = `/api/stock/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&channel=${filterChannel}`;
      }
      const days = dateRange.preset === 'today' ? 1 : dateRange.preset === '7d' ? 7 : 30;
      const [s, o, h, cd, settings, cp] = await Promise.all([
        stockApi.get<SaldoData>('/api/stock/saldo', token),
        stockApi.get<OverviewData>(overviewUrl, token),
        stockApi.get<{ list: { nama_supplier: string; jatuh_tempo: string | null; nominal_hutang: number; jumlah_dibayar: number }[] }>('/api/stock/hutang?status=unpaid', token),
        stockApi.get<any>(`/api/stock/dashboard/charts?days=${chartDays}`, token),
        stockApi.get<{ settings: any }>('/api/stock/settings', token),
        stockApi.get<ChannelProfit[]>('/api/stock/channel-profitability', token),
      ]);
      setSaldo(s);
      setOverview(o);
      setChartData(cd);
      if (settings.settings?.active_channels) setActiveChannels(settings.settings.active_channels);
      setChannelProfit(cp);

      const a: AlertItem[] = [];
      if (o.stok_habis > 0) a.push({ id: 'out', nama: 'Stok Habis', type: 'stok_habis', detail: `${o.stok_habis} produk habis`, link: '/stock/products' });
      if (o.stok_menipis > 0) a.push({ id: 'low', nama: 'Stok Menipis', type: 'stok_menipis', detail: `${o.stok_menipis} produk menipis`, link: '/stock/products' });
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
      setAlerts(a);
    } catch { /* ignore */ }
  }, [token, chartDays, filterChannel, dateRange]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

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

      {/* Hero — Saldo Kas */}
      <div className="ov-hero" style={{ transition: 'opacity 0.3s' }}>
        <div className="ov-hero-body">
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
          <Wallet size={48} className="ov-hero-icon" style={{ opacity: saldo ? 1 : 0.3, transition: 'opacity 0.3s' }} />
        </div>
      </div>

      {/* AI Analysis */}
      {loading ? <AIAnalysisSkeleton /> : overview && (
        <AIAnalysis overview={overview} storeName={user?.store_name || 'Owner'} preset={dateRange.preset} />
      )}

      {/* Quick Stats */}
      <div className="ov-stats-grid">
        {[0, 1, 2, 3].map(i => {
          const cards = [
            { label: 'Pendapatan', value: fmtRp(overview?.total_omzet || 0), color: 'var(--primary)', icon: TrendingUp, link: '/stock/laba-rugi' },
            { label: 'Laba Bersih', value: fmtRp(overview?.laba_bersih || 0), color: (overview?.laba_bersih || 0) >= 0 ? 'var(--primary)' : 'var(--danger)', icon: TrendingUp, link: '/stock/laba-rugi' },
            { label: 'Piutang', value: fmtRp(overview?.piutang || 0), color: (overview?.piutang || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)', icon: Users, link: '/stock/piutang' },
            { label: 'Inventori', value: fmtRp(overview?.nilai_inventori || 0), color: 'var(--secondary)', icon: Package, link: undefined },
          ];
          const c = cards[i];
          return (
            <div key={c.label} className={`card card-p ov-stat-card ${overview ? 'data-enter' : ''}`} style={{ animationDelay: `${i * 0.08}s` }} onClick={() => c.link && navigate(c.link)}>
              <div className="ov-stat-icon-row" style={{ color: c.color }}>
                <c.icon size={14} /> {c.label}
              </div>
              <div className="ov-stat-value" style={{ color: c.color }}>
                <ShimmerVal loading={loading} width="140px" height="1.4rem">{c.value}</ShimmerVal>
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI */}
      <div className="ov-kpi-grid" style={{ opacity: overview ? 1 : 0.5, transition: 'opacity 0.3s' }}>
        {[
          { icon: Percent, label: 'Margin Laba', value: overview?.profit_margin.toFixed(1) || '0', unit: '%', color: (overview?.laba_bersih || 0) >= 0 ? 'var(--primary)' : 'var(--danger)' },
          { icon: BarChart, label: 'Rasio HPP', value: hppRatio.toFixed(1), unit: '%', color: 'var(--warning)' },
          { icon: PieChart, label: 'Rasio Biaya', value: expenseRatio.toFixed(1), unit: '%', color: 'var(--danger)' },
          { icon: Package, label: 'Stok Habis', value: habisPct.toFixed(1), unit: '%', color: habisPct > 0 ? 'var(--danger)' : 'var(--text-muted)' },
          { icon: AlertTriangle, label: 'Stok Menipis', value: menipisPct.toFixed(1), unit: '%', color: menipisPct > 0 ? 'var(--warning)' : 'var(--text-muted)' },
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

      {/* Empty State */}
      {!loading && !saldo && !overview && (
        <div className="card card-p ov-empty data-enter">
          <div className="ov-empty-icon">📊</div>
          <div className="ov-empty-title">Selamat Datang di Dashboard</div>
          <p className="ov-empty-desc">Mulai dengan menambahkan produk dan mencatat transaksi pertama Anda.</p>
        </div>
      )}
    </div>
  );
}
