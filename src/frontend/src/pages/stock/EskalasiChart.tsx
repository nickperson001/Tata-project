import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { TrendingUp } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export function EskalasiChart({ labels, revenue, expense }: { labels: string[]; revenue: number[]; expense: number[] }) {
  const hasData = labels.length > 0 && (revenue.length > 0 || expense.length > 0);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 6,
          padding: 16,
          font: { size: 11, weight: '600' as const },
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: '700' as const },
        bodyFont: { size: 11 },
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 8,
        boxPadding: 4,
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: Rp${Number(ctx.raw).toLocaleString('id')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, font: { size: 11 }, padding: 6 },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: {
          font: { size: 11 },
          padding: 8,
          callback: (v: any) => 'Rp' + (v / 1000).toFixed(0) + 'rb',
        },
      },
    },
  }), []);

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Pendapatan',
        data: revenue,
        borderColor: '#10b981',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(16,185,129,0.1)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(16,185,129,0.18)');
          gradient.addColorStop(1, 'rgba(16,185,129,0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#10b981',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
      {
        label: 'Pengeluaran',
        data: expense,
        borderColor: '#ef4444',
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(239,68,68,0.08)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(239,68,68,0.15)');
          gradient.addColorStop(1, 'rgba(239,68,68,0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#ef4444',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
    ],
  }), [labels, revenue, expense]);

  if (!hasData) {
    return (
      <div className="chart-shell">
        <div className="chart-shell__empty">
          <span className="chart-shell__empty-icon">
            <TrendingUp size={20} />
          </span>
          <p className="chart-shell__empty-title">Belum ada tren revenue vs expense</p>
          <p className="chart-shell__empty-text">Grafik ini akan tampil setelah ada histori transaksi pada periode yang dipilih.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-shell" style={{ minHeight: 280 }}>
      <div className="chart-container chart-shell__canvas" style={{ height: 280 }}>
        <Line options={options} data={data} />
      </div>
    </div>
  );
}
