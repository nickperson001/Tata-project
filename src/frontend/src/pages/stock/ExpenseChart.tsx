import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function ExpenseChart({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="chart-container" style={{ height: 240 }}>
      <Doughnut
        data={{
          labels,
          datasets: [{ data: values, backgroundColor: COLORS.slice(0, labels?.length), borderWidth: 0 }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                  return `${ctx.label}: Rp${Number(ctx.parsed).toLocaleString('id')} (${pct}%)`;
                },
              },
            },
          },
          cutout: '65%',
        }}
      />
    </div>
  );
}
