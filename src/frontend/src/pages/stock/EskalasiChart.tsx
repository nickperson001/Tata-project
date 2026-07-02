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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { position: 'top' as const, labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: Rp${Number(ctx.raw).toLocaleString('id')}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 8, font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: {
        font: { size: 11 },
        callback: (v: any) => 'Rp' + (v / 1000).toFixed(0) + 'rb',
      },
    },
  },
};

export function EskalasiChart({ labels, revenue, expense }: { labels: string[]; revenue: number[]; expense: number[] }) {
  return (
    <div className="chart-container" style={{ height: 280 }}>
      <Line
        options={options}
        data={{
          labels,
          datasets: [
            {
              label: 'Pendapatan',
              data: revenue,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
              pointHitRadius: 10,
            },
            {
              label: 'Pengeluaran',
              data: expense,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.08)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
              pointHitRadius: 10,
            },
          ],
        }}
      />
    </div>
  );
}
