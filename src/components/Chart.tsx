import dayjs from 'dayjs';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface Point {
  date: string;
  value: number;
  /** Tooltip detail line, e.g. "62.5 kg × 8". */
  detail?: string;
}

interface Props {
  points: Point[];
  color: string;
  unit: string;
  kind?: 'line' | 'bar';
  height?: number;
}

const AXIS = { fontSize: 11, fill: 'rgb(60 60 67 / 0.6)' };

function Tip({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: string }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-[10px] bg-card px-3 py-2 text-left shadow-[0_6px_24px_rgb(0_0_0/0.14)]">
      <div className="text-caption font-semibold text-label-2">{dayjs(p.date).format('ddd D MMM YYYY')}</div>
      <div className="text-headline font-bold tabular text-label">
        {+p.value.toFixed(1)} {unit}
      </div>
      {p.detail && <div className="text-footnote text-label-2">{p.detail}</div>}
    </div>
  );
}

/** Single-series chart: one hue, recessive grid, crosshair tooltip. */
export function Chart({ points, color, unit, kind = 'line', height = 200 }: Props) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const domain: [number, number] = kind === 'bar' ? [0, Math.max(1, Math.ceil(hi * 1.1))] : [Math.floor(lo - pad), Math.ceil(hi + pad)];
  const common = {
    data: points,
    margin: { top: 8, right: 8, bottom: 0, left: -12 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="rgb(60 60 67 / 0.1)" />
      <XAxis
        dataKey="date"
        tick={AXIS}
        tickLine={false}
        axisLine={false}
        minTickGap={24}
        tickFormatter={(d: string) => dayjs(d).format('D MMM')}
      />
      <YAxis domain={domain} tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} tickCount={4} />
      <Tooltip
        content={<Tip unit={unit} />}
        cursor={kind === 'line' ? { stroke: 'rgb(60 60 67 / 0.3)', strokeWidth: 1 } : { fill: 'rgb(118 118 128 / 0.08)' }}
      />
    </>
  );

  return (
    <div style={{ height }} aria-label={`Chart of ${points.length} points`} role="img">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? (
          <LineChart {...common}>
            {axes}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={!matchMedia('(prefers-reduced-motion: reduce)').matches}
            />
          </LineChart>
        ) : (
          <BarChart {...common} barCategoryGap={2}>
            {axes}
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
