import type { Observation, Quantity } from 'fhir/r4';
import { useId } from 'react';
import { LOINC, codings, conceptText, effectiveTime, formatDateTime, formatTime, hasCode, unitText } from '@/lib/wardkit/fhir';
import { cn } from '@/lib/utils';

export interface VitalsTrendProps {
  /** Observations of one vital sign, in any order. */
  observations: Observation[];
  /** Plot this component instead of valueQuantity, e.g. "8480-6" for systolic from a 85354-9 panel (LOINC). */
  componentCode?: string;
  /** Break the line when two readings are further apart than this. Without it, only recorded gaps break the line. */
  maxGapMinutes?: number;
  /** Chart title. Defaults to the Observation code text. */
  title?: string;
  /** IANA time zone for the time axis, e.g. "Europe/Vienna". */
  timeZone?: string;
  className?: string;
}

export interface TrendPoint { time: Date; value: number; o: Observation }
export interface TrendGap { time: Date; reason: string }
export interface TrendModel {
  error?: string;
  title: string;
  unit: string;
  segments: TrendPoint[][];
  /** Recorded gaps: a dataAbsentReason, no value, entered in error, cancelled, or an inexact value. */
  gaps: TrendGap[];
  /** Spans between two readings longer than maxGapMinutes. */
  longGaps: Array<{ from: Date; to: Date; minutes: number }>;
  /** Readings without a time: listed, never placed. */
  untimed: number;
  range?: { low?: number; high?: number; text: string };
  rows: Array<{ time: Date; text: string }>;
}

function codeKey(o: Observation): string | undefined {
  const c = codings(o.code).find((x) => x.system && x.code);
  return c ? `${c.system}|${c.code}` : undefined;
}

function absentReason(cc: Observation['dataAbsentReason']): string {
  return [codings(cc).find((c) => c.display)?.display ?? codings(cc)[0]?.code, cc?.text].filter(Boolean).join(': ') || 'Data absent';
}

/** Turns Observations into line segments and gaps. Never interpolates: a gap is a break in the line. */
export function trendModel(observations: Observation[], opts: { componentCode?: string; maxGapMinutes?: number } = {}): TrendModel {
  const relevant = observations.filter((o) => o.status !== 'registered');
  const title = conceptText(relevant[0]?.code) ?? 'Vital sign';
  const keys = new Set(relevant.map(codeKey).filter(Boolean));
  const base: TrendModel = { title, unit: '', segments: [], gaps: [], longGaps: [], untimed: 0, rows: [] };
  if (keys.size > 1) return { ...base, error: `These readings have ${keys.size} different codes. One chart shows one vital sign.` };

  type R = { time: Date; o: Observation; q?: Quantity; gap?: string };
  const readings: R[] = [];
  for (const o of relevant) {
    const time = effectiveTime(o);
    if (!time) { base.untimed += 1; continue; }
    const comp = opts.componentCode ? o.component?.find((c) => hasCode(c.code, LOINC, opts.componentCode!)) : undefined;
    const q = opts.componentCode ? comp?.valueQuantity : o.valueQuantity;
    const absent = opts.componentCode ? comp?.dataAbsentReason ?? o.dataAbsentReason : o.dataAbsentReason;
    if (o.status === 'entered-in-error') readings.push({ time, o, gap: 'Entered in error, not shown' });
    else if (o.status === 'cancelled') readings.push({ time, o, gap: 'Cancelled' });
    else if (absent) readings.push({ time, o, gap: `Not measured: ${absentReason(absent)}` });
    else if (q?.value === undefined) readings.push({ time, o, gap: 'No value recorded' });
    else if (q.comparator) readings.push({ time, o, gap: `Value ${q.comparator}${q.value} is not exact, not plotted` });
    else readings.push({ time, o, q });
  }
  const units = new Set(readings.filter((r) => r.q).map((r) => r.q!.code ?? r.q!.unit ?? ''));
  if (units.size > 1) return { ...base, error: `These readings use ${units.size} different units (${[...units].join(', ')}). They are not converted or plotted together.` };
  const first = readings.find((r) => r.q)?.q;
  const unit = unitText(first);
  readings.sort((a, b) => a.time.getTime() - b.time.getTime());

  const segments: TrendPoint[][] = [];
  let current: TrendPoint[] = [];
  const close = () => { if (current.length) segments.push(current); current = []; };
  for (const r of readings) {
    if (r.gap) {
      close();
      base.gaps.push({ time: r.time, reason: r.gap });
      base.rows.push({ time: r.time, text: r.gap });
      continue;
    }
    const p: TrendPoint = { time: r.time, value: r.q!.value!, o: r.o };
    const prev = current[current.length - 1];
    if (prev && opts.maxGapMinutes !== undefined) {
      const minutes = (p.time.getTime() - prev.time.getTime()) / 60000;
      if (minutes > opts.maxGapMinutes) {
        close();
        base.longGaps.push({ from: prev.time, to: p.time, minutes: Math.round(minutes) });
      }
    }
    current.push(p);
    base.rows.push({ time: r.time, text: `${p.value}${unit ? ` ${unit}` : ''}` });
  }
  close();

  // Reference band from the most recent reading that carries a numeric range.
  const withRange = [...readings].reverse().find((r) => {
    const rr = r.o.referenceRange?.[0];
    return rr && (rr.low?.value !== undefined || rr.high?.value !== undefined);
  });
  const rr = withRange?.o.referenceRange?.[0];
  const range = rr
    ? {
        low: rr.low?.value,
        high: rr.high?.value,
        text: rr.low?.value !== undefined && rr.high?.value !== undefined ? `${rr.low.value} to ${rr.high.value}` : rr.low?.value !== undefined ? `${rr.low.value} or more` : `${rr.high!.value} or less`,
      }
    : undefined;
  return { ...base, unit, segments, range };
}

const W = 640;
const H = 220;
const M = { top: 12, right: 16, bottom: 30, left: 48 };

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

export function VitalsTrend({ observations, componentCode, maxGapMinutes, title, timeZone, className }: VitalsTrendProps) {
  const id = useId();
  const m = trendModel(observations, { componentCode, maxGapMinutes });
  const heading = title ?? m.title;

  if (m.error) {
    return (
      <section aria-label={`Trend: ${heading}`} className={cn('rounded-lg border border-dashed bg-card p-4 text-card-foreground', className)}>
        <h3 className="text-base font-semibold">{heading}</h3>
        <p className="mt-2 text-sm" role="alert">Not plotted. {m.error}</p>
      </section>
    );
  }

  const points = m.segments.flat();
  const times = [...points.map((p) => p.time.getTime()), ...m.gaps.map((g) => g.time.getTime())];
  if (times.length === 0) {
    return (
      <section aria-label={`Trend: ${heading}`} className={cn('rounded-lg border border-dashed bg-card p-4 text-card-foreground', className)}>
        <h3 className="text-base font-semibold">{heading}</h3>
        <p className="mt-2 text-sm">No readings with a time to plot.{m.untimed ? ` ${m.untimed} reading(s) have no time.` : ''}</p>
      </section>
    );
  }

  let t0 = Math.min(...times);
  let t1 = Math.max(...times);
  if (t0 === t1) { t0 -= 30 * 60000; t1 += 30 * 60000; }
  const values = [...points.map((p) => p.value), ...(m.range ? [m.range.low, m.range.high].filter((v): v is number => v !== undefined) : [])];
  let v0 = values.length ? Math.min(...values) : 0;
  let v1 = values.length ? Math.max(...values) : 1;
  if (v0 === v1) { v0 -= 1; v1 += 1; }
  const pad = (v1 - v0) * 0.1;
  v0 -= pad; v1 += pad;

  const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * (W - M.left - M.right);
  const y = (v: number) => H - M.bottom - ((v - v0) / (v1 - v0)) * (H - M.top - M.bottom);
  const multiDay = t1 - t0 > 20 * 3600000;
  const tick = (t: number) => (multiDay ? formatDateTime(new Date(t), timeZone).replace(/ \d{4},/, ',') : formatTime(new Date(t), timeZone));
  // Ticks on whole hours (UTC hours, which are whole local hours in most zones), at most six.
  const HOUR = 3600000;
  const stepH = [1, 2, 3, 4, 6, 12, 24, 48].find((h) => (t1 - t0) / (h * HOUR) <= 6) ?? 96;
  const xTicks: number[] = [];
  for (let t = Math.ceil(t0 / (stepH * HOUR)) * stepH * HOUR; t <= t1; t += stepH * HOUR) xTicks.push(t);
  const yTicks = niceTicks(v0, v1);
  const gapCount = m.gaps.length + m.longGaps.length;
  const last = points[points.length - 1];
  const summary = `${heading}: ${points.length} reading${points.length === 1 ? '' : 's'}${last ? `, latest ${last.value} ${m.unit}` : ''}, ${gapCount} gap${gapCount === 1 ? '' : 's'}${m.range ? `, reference range ${m.range.text} ${m.unit}` : ''}.`;
  const hatch = `${id}-hatch`;

  return (
    <figure aria-label={`Trend: ${heading}`} className={cn('rounded-lg border bg-card p-4 text-card-foreground', className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-base font-semibold">{heading}{m.unit ? <span className="font-normal text-muted-foreground"> ({m.unit})</span> : null}</span>
        <span className="text-sm text-muted-foreground">
          {gapCount > 0 ? `${gapCount} gap${gapCount === 1 ? '' : 's'}, line not joined across` : 'No gaps'}
          {m.range ? `. Shaded: reference range ${m.range.text}` : ''}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="mt-2 h-auto w-full">
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-muted-foreground" strokeWidth="1.5" strokeOpacity="0.45" />
          </pattern>
        </defs>
        {m.range && (
          <rect
            x={M.left}
            width={W - M.left - M.right}
            y={y(m.range.high ?? v1)}
            height={Math.max(0, y(m.range.low ?? v0) - y(m.range.high ?? v1))}
            className="fill-emerald-600/15 dark:fill-emerald-400/15"
          />
        )}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth="1" />
            <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{v}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={x(t)} x2={x(t)} y1={H - M.bottom} y2={H - M.bottom + 4} className="stroke-muted-foreground" strokeWidth="1" />
            <text x={x(t)} y={H - 8} textAnchor={x(t) < M.left + 20 ? 'start' : x(t) > W - M.right - 20 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
              {tick(t)}
            </text>
          </g>
        ))}
        {m.longGaps.map((g, i) => (
          <g key={`l${i}`}>
            <rect x={x(g.from.getTime())} width={Math.max(2, x(g.to.getTime()) - x(g.from.getTime()))} y={M.top} height={H - M.top - M.bottom} fill={`url(#${hatch})`} />
            <title>{`No reading for ${g.minutes} min`}</title>
          </g>
        ))}
        {m.gaps.map((g, i) => (
          <g key={`g${i}`}>
            <rect x={x(g.time.getTime()) - 5} width="10" y={M.top} height={H - M.top - M.bottom} fill={`url(#${hatch})`} />
            <path d={`M${x(g.time.getTime()) - 4} ${H - M.bottom - 8} l8 8 m0 -8 l-8 8`} className="stroke-foreground" strokeWidth="1.5" />
            <title>{g.reason}</title>
          </g>
        ))}
        {m.segments.map((s, i) => (
          <polyline
            key={`s${i}`}
            points={s.map((p) => `${x(p.time.getTime()).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
            fill="none"
            className="stroke-foreground"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {points.map((p, i) => (
          <circle key={`p${i}`} cx={x(p.time.getTime())} cy={y(p.value)} r="3" className="fill-foreground" />
        ))}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Readings ({m.rows.length}){m.untimed ? `, ${m.untimed} without a time not plotted` : ''}</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr><th scope="col" className="pr-4 font-medium">Time</th><th scope="col" className="font-medium">Reading</th></tr>
          </thead>
          <tbody>
            {m.rows.map((r, i) => (
              <tr key={i}><td className="pr-4 tabular-nums">{formatDateTime(r.time, timeZone)}</td><td>{r.text}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
