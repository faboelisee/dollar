'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FluxDataPoint, Currency } from '@/types';

interface FluxChartProps {
  data: FluxDataPoint[];
  currency?: Currency;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FluxChart({ data, currency = 'XOF' }: FluxChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    date: formatDate(d.date, 'dd/MM'),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#27AE60" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#27AE60" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#E74C3C" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2E86AB" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2E86AB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#7F8C8D' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#7F8C8D' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(0)}k`
              : String(v)
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => (
            <span style={{ color: '#2C3E50' }}>{value}</span>
          )}
        />
        <Area
          type="monotone"
          dataKey="inflows"
          name="Encaissements"
          stroke="#27AE60"
          strokeWidth={2}
          fill="url(#colorInflows)"
        />
        <Area
          type="monotone"
          dataKey="outflows"
          name="Décaissements"
          stroke="#E74C3C"
          strokeWidth={2}
          fill="url(#colorOutflows)"
        />
        <Area
          type="monotone"
          dataKey="balance"
          name="Solde"
          stroke="#2E86AB"
          strokeWidth={2}
          fill="url(#colorBalance)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
