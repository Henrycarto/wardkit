import type { Observation } from 'fhir/r4';
import { AlertOctagon, AlertTriangle, CircleHelp, Info, ShieldCheck } from 'lucide-react';
import { formatTime } from '@/lib/wardkit/fhir';
import { PARAM_LABEL, RISK_LABEL, news2FromObservations, type ParamReading, type Risk } from '@/lib/wardkit/news2';
import { cn } from '@/lib/utils';

export interface News2PanelProps {
  /** Recent Observations for the patient. Only the NEWS2 LOINC codes are read; others are ignored. */
  observations: Observation[];
  /** The time the score is for. Readings after it are rejected, readings older than maxAgeMinutes are stale. */
  now: Date | string;
  /** How old a reading may be and still count, in minutes. */
  maxAgeMinutes: number;
  /** SpO2 scale 2, only when a clinician has prescribed it (hypercapnic respiratory failure, target 88 to 92%). */
  spo2Scale?: 1 | 2;
  /** IANA time zone for reading times, e.g. "Europe/Vienna". */
  timeZone?: string;
  className?: string;
}

const RISK_STYLE: Record<Risk, { box: string; icon: typeof AlertTriangle }> = {
  low: { box: 'border-border bg-muted text-foreground', icon: ShieldCheck },
  'low-medium': { box: 'border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100', icon: AlertTriangle },
  medium: { box: 'border-orange-700 bg-orange-50 text-orange-950 dark:border-orange-400 dark:bg-orange-950 dark:text-orange-100', icon: AlertTriangle },
  high: { box: 'border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100', icon: AlertOctagon },
};

function ValueCell({ p, timeZone }: { p: ParamReading; timeZone?: string }) {
  const r = p.reading;
  if (r.state === 'missing') {
    return (
      <span className="inline-flex items-start gap-1">
        <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span><span className="font-medium">Missing.</span> {r.reason}</span>
      </span>
    );
  }
  return (
    <span>
      <span className="font-medium tabular-nums">{r.used}</span>
      {r.rounded && <span className="text-muted-foreground"> (recorded {r.recorded}{r.note ? `, ${r.note}` : ''})</span>}
      {!r.rounded && r.note && <span className="text-muted-foreground"> ({r.note})</span>}
      <span className="text-muted-foreground"> at {formatTime(r.time, timeZone)}</span>
    </span>
  );
}

export function News2Panel({ observations, now, maxAgeMinutes, spo2Scale = 1, timeZone, className }: News2PanelProps) {
  const result = news2FromObservations(observations, { now, maxAgeMinutes, spo2Scale });
  const red = result.params.filter((p) => p.points === 3).map((p) => PARAM_LABEL[p.param]);

  return (
    <section aria-label="NEWS2 score" className={cn('rounded-lg border bg-card p-4 text-card-foreground', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">NEWS2</h3>
        <p className="text-sm text-muted-foreground">SpO₂ scale {result.spo2Scale}{result.spo2Scale === 2 ? ', prescribed target 88 to 92%' : ''}</p>
      </div>

      {result.complete ? (
        <div className={cn('mt-3 rounded-md border p-3', RISK_STYLE[result.score.risk].box)}>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {(() => { const Icon = RISK_STYLE[result.score.risk].icon; return <Icon aria-hidden="true" className="size-5 shrink-0" />; })()}
            <span className="text-2xl font-semibold tabular-nums">Score {result.score.total}</span>
            <span className="font-medium">{RISK_LABEL[result.score.risk]}</span>
          </p>
          {red.length > 0 && (
            <p className="mt-1 text-sm font-medium">
              Score of 3 in a single parameter: {red.join(', ')}.{result.score.risk === 'low-medium' ? ' This alone sets the risk to low-medium.' : ''}
            </p>
          )}
          <p className="mt-1 text-sm">{result.score.response}</p>
          <p className="text-sm">{result.score.frequency}.</p>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-foreground/60 p-3">
          <p className="flex items-center gap-2">
            <CircleHelp aria-hidden="true" className="size-5 shrink-0" />
            <span className="text-lg font-semibold">Incomplete: no score</span>
          </p>
          <p className="mt-1 text-sm">
            Missing: {result.missing.map((p) => PARAM_LABEL[p]).join(', ')}. NEWS2 is not calculated from a partial set or a guessed value.
          </p>
          {result.red.length > 0 && (
            <p className="mt-1 flex items-start gap-1 text-sm font-medium">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Already a score of 3 in {result.red.map((p) => PARAM_LABEL[p]).join(', ')}: on its own this needs at least an urgent ward-based response.</span>
            </p>
          )}
        </div>
      )}

      <table className="mt-3 w-full text-left text-sm">
        <caption className="sr-only">NEWS2 parameters, values used and points</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-1 pr-3 font-medium">Parameter</th>
            <th scope="col" className="py-1 pr-3 font-medium">Value used</th>
            <th scope="col" className="py-1 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {result.params.map((p) => (
            <tr key={p.param} className="border-b last:border-0 align-top">
              <th scope="row" className="py-1 pr-3 font-normal">{PARAM_LABEL[p.param]}</th>
              <td className="py-1 pr-3"><ValueCell p={p} timeZone={timeZone} /></td>
              <td className={cn('py-1 text-right tabular-nums', p.points === 3 && 'font-semibold')}>
                {p.points === undefined ? <span className="text-muted-foreground">none</span> : p.points === 3 ? `${p.points} (red)` : p.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
