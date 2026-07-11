import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Package } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export function TopProductsChart({ products }: { products: { name: string; revenue: number; qty: number }[] }) {
  const hasData = products.length > 0;

  const chartData = useMemo(() => ({
    labels: products.map(p => p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name),
    datasets: [
      {
        label: 'Revenue',
        data: products.map(p => p.revenue),
        backgroundColor: (ctx: any) => {
          const idx = ctx.dataIndex;
          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];
          return colors[idx % colors.length] + 'cc';
        },
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 18,
      },
    ],
  }), [products]);

  const chartOptions = useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: '700' as const },
        bodyFont: { size: 11 },
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 8,
        boxPadding: 4,
        callbacks: {
          label: (ctx: any) => ` Rp${Number(ctx.raw).toLocaleString('id')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          font: { size: 10 },
          padding: 4,
          callback: (v: any) => 'Rp' + (v / 1000).toFixed(0) + 'rb',
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 10, weight: '500' as const }, padding: 4 },
      },
    },
  }), []);

  if (!hasData) {
    return (
      <div className="chart-shell">
        <div className="chart-shell__empty">
          <span className="chart-shell__empty-icon">
            <Package size={20} />
          </span>
          <p className="chart-shell__empty-title">Belum ada produk terlaris</p>
          <p className="chart-shell__empty-text">Produk dengan penjualan tertinggi akan muncul di sini setelah transaksi mulai tercatat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-shell" style={{ minHeight: 240 }}>
      <div className="chart-container chart-shell__canvas" style={{ height: 240 }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
