import { useState, type PointerEvent } from 'react';
import { daysBetween, formatShortDate, parseISODate } from '../lib/dates';
import { niceTicks } from '../lib/stats';

const W = 340;
const PAD = { left: 40, right: 16, top: 14, bottom: 24 };

const shortDay = (iso: string) =>
  parseISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Pointer position in viewBox units. */
const viewX = (e: PointerEvent<SVGSVGElement>) => {
  const box = e.currentTarget.getBoundingClientRect();
  return ((e.clientX - box.left) / box.width) * W;
};

export interface LinePoint {
  date: string;
  value: number;
}

/**
 * One series over time. Touch or hover picks the nearest point; the readout
 * above the plot shows its value, so no number has to sit on every point.
 */
export function LineChart(props: { points: LinePoint[]; format: (n: number) => string; label: string }) {
  const { points, format, label } = props;
  const [picked, setPicked] = useState<number | null>(null);
  if (!points.length) return null;

  const H = 180;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 3);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const span = daysBetween(points[0].date, points[points.length - 1].date);
  const x = (p: LinePoint) =>
    span === 0 ? PAD.left + plotW / 2 : PAD.left + (daysBetween(points[0].date, p.date) / span) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const last = points.length - 1;
  const active = picked !== null && picked < points.length ? picked : last;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const base = PAD.top + plotH;
  const area = `${line} L${x(points[last]).toFixed(1)},${base} L${x(points[0]).toFixed(1)},${base} Z`;
  const showAllDots = points.length <= 24;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const px = viewX(e);
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p) - px) < Math.abs(x(points[best]) - px)) best = i;
    });
    setPicked(best);
  };

  return (
    <div>
      <p className="readout">
        <b>{format(points[active].value)}</b>{' '}
        <span className="muted">
          · {formatShortDate(points[active].date)}
          {active === last && points.length > 1 ? ' · latest' : ''}
        </span>
      </p>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${points.length} results, latest ${format(points[last].value)}`}
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0) && pick(e)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setPicked(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} textAnchor="start">
          {shortDay(points[0].date)}
        </text>
        {span > 0 && (
          <text x={W - PAD.right} y={H - 6} textAnchor="end">
            {shortDay(points[last].date)}
          </text>
        )}
        {points.length > 1 && (
          <>
            <path d={area} fill="var(--accent)" opacity="0.1" />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {picked !== null && (
          <line
            x1={x(points[active])}
            x2={x(points[active])}
            y1={PAD.top}
            y2={base}
            stroke="var(--muted)"
            strokeWidth="1"
          />
        )}
        {points.map((p, i) =>
          showAllDots || i === active || i === last ? (
            <circle
              key={i}
              cx={x(p)}
              cy={y(p.value)}
              r={i === active ? 6 : 4}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}

export interface BarDatum {
  key: string;
  /** Short axis label; may be empty to skip a tick. */
  tick: string;
  /** Full description for the readout, e.g. "Week of Mon 9 Nov". */
  name: string;
  value: number;
}

/** Columns from a zero baseline. Tap or hover a column to read its value. */
export function BarChart(props: { data: BarDatum[]; unit: (n: number) => string; label: string }) {
  const { data, unit, label } = props;
  const [picked, setPicked] = useState<number | null>(null);
  if (!data.length) return null;

  const H = 160;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max, Math.min(4, max)).filter((t) => Number.isInteger(t));
  const hi = Math.max(max, ticks[ticks.length - 1]);
  const band = plotW / data.length;
  const barW = Math.min(24, band - 2);
  const base = PAD.top + plotH;
  const active = picked !== null && picked < data.length ? picked : data.length - 1;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const i = Math.floor((viewX(e) - PAD.left) / band);
    setPicked(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div>
      <p className="readout">
        <b>{unit(data[active].value)}</b> <span className="muted">· {data[active].name}</span>
      </p>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0) && pick(e)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setPicked(null)}
      >
        {ticks.map((t) => {
          const ty = base - (t / hi) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={ty} y2={ty} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 6} y={ty + 4} textAnchor="end">
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const h = (d.value / hi) * plotH;
          const r = Math.min(4, h);
          const x0 = cx - barW / 2;
          const top = base - h;
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  d={`M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`}
                  fill="var(--accent)"
                  opacity={i === active ? 1 : 0.55}
                />
              )}
              {d.tick && (
                <text x={cx} y={H - 6} textAnchor="middle">
                  {d.tick}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
