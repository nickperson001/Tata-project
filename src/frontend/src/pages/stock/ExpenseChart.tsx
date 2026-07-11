import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { PieChart } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function ExpenseChart({ labels, values }: { labels: string[]; values: number[] }) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const hasData = labels.length > 0 && values.length > 0 && total > 0;

  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      data: values,
      backgroundColor: COLORS.slice(0, labels?.length),
      borderWidth: 2,
      borderColor: 'var(--bg-card)',
      hoverOffset: 6,
    }],
  }), [labels, values]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 10,
          padding: 10,
          font: { size: 11, weight: '500' as const },
          usePointStyle: true,
          pointStyle: 'rectRounded',
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
          label: (ctx: any) => {
            const datasetTotal = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const pct = datasetTotal > 0 ? ((ctx.parsed / datasetTotal) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: Rp${Number(ctx.parsed).toLocaleString('id')} (${pct}%)`;
          },
        },
      },
    },
  }), []);

  if (!hasData) {
    return (
      <div className="chart-shell">
        <div className="chart-shell__empty">
          <span className="chart-shell__empty-icon">
            <PieChart size={20} />
          </span>
          <p className="chart-shell__empty-title">Belum ada distribusi pengeluaran</p>
          <p className="chart-shell__empty-text">Tambahkan transaksi biaya agar kategori pengeluaran bisa dipetakan di grafik ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-shell" style={{ minHeight: 240 }}>
      <div className="chart-container chart-shell__canvas" style={{ height: 240 }}>
        <Doughnut data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
