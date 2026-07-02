import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export function TopProductsChart({ products }: { products: { name: string; revenue: number; qty: number }[] }) {
  return (
    <div className="chart-container" style={{ height: 240 }}>
      <Bar
        data={{
          labels: products?.map(p => p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name) || [],
          datasets: [
            {
              label: 'Revenue',
              data: products?.map(p => p.revenue) || [],
              backgroundColor: '#10b981',
              borderRadius: 4,
            },
          ],
        }}
        options={{
          indexAxis: 'y' as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `Rp${Number(ctx.raw).toLocaleString('id')}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 10 },
                callback: (v: any) => 'Rp' + (v / 1000).toFixed(0) + 'rb',
              },
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 10 } },
            },
          },
        }}
      />
    </div>
  );
}
