import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Box, Stack, Typography } from '@mui/material';
import { brand } from '../theme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);
ChartJS.defaults.font.family = '"Manrope", system-ui, sans-serif';
ChartJS.defaults.color = brand.ink2;

const grid = { color: '#EFEFEF' };

export function LineChart({ labels, series, height = 200, money, legend = false }) {
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color || brand.orange,
      backgroundColor: s.fill ? `${s.color || brand.orange}22` : s.color || brand.orange,
      fill: !!s.fill,
      tension: 0.3,
      pointRadius: labels.length > 14 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    })),
  };
  const options = {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: legend, position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { callbacks: money ? { label: (c) => `${c.dataset.label || ''} ₱${Number(c.raw).toLocaleString()}` } : {} } },
    scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, grid, ticks: { precision: 0, callback: money ? (v) => (v >= 1000 ? `₱${v / 1000}k` : `₱${v}`) : undefined } } },
  };
  return <Box sx={{ height }}><Line data={data} options={options} /></Box>;
}

export function BarChart({ labels, data, height = 180, color = '#F4A261', highlight, highlightColor = brand.orange, dark, label = 'Value' }) {
  const colors = data.map((_, i) => (i === highlight ? highlightColor : color));
  const options = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: dark ? '#9A9A9A' : brand.ink2, maxTicksLimit: 9 } },
      y: { beginAtZero: true, grid: { color: dark ? '#34343A' : '#EFEFEF' }, ticks: { color: dark ? '#9A9A9A' : brand.ink2, maxTicksLimit: 5 } },
    },
  };
  return <Box sx={{ height }}><Bar data={{ labels, datasets: [{ label, data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 36 }] }} options={options} /></Box>;
}

export function DonutChart({ segments, center, sub, size = 150 }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
      <Box sx={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <Doughnut
          data={{ labels: segments.map((s) => s.label), datasets: [{ data: total ? segments.map((s) => s.value) : [1], backgroundColor: total ? segments.map((s) => s.color) : ['#EEE'], borderWidth: 0 }] }}
          options={{ cutout: '68%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: total > 0 } } }}
        />
        <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{center ?? total}</Typography>
          <Typography variant="caption" color="text.secondary">{sub}</Typography>
        </Stack>
      </Box>
      <Stack spacing={1}>
        {segments.map((s) => (
          <Box key={s.label}>
            <Typography variant="body2" fontWeight={700}>
              <Box component="span" sx={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', bgcolor: s.color, mr: 0.8 }} />
              {s.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">{s.value} ({total ? Math.round((s.value / total) * 100) : 0}%)</Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

export function Ring({ value, label, size = 110 }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <Stack alignItems="center" spacing={0.5}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${Math.round(v)}% ${label}`}>
        <circle r={r} cx="50" cy="50" fill="none" stroke="#F1F1F1" strokeWidth="11" />
        <circle r={r} cx="50" cy="50" fill="none" stroke={brand.orange} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="56" textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: brand.ink }}>{Math.round(v)}%</text>
      </svg>
      <Typography variant="caption" fontWeight={700}>{label}</Typography>
    </Stack>
  );
}
