/**
 * NEWS2, the National Early Warning Score 2 (Royal College of Physicians, 2017).
 *
 * Two layers. `score` and the band functions are pure: seven numbers in, points and the clinical
 * response out (ported from the ward monitor; temperature now rounds on the decimal value, so
 * 36.05 is 36.1 and not 36.0). `news2FromObservations` reads FHIR R4
 * Observations by LOINC code and decides, per parameter, whether there is a value the score can
 * use. When any parameter is missing, stale or unreadable there is no total: a NEWS2 computed
 * from a guessed value is worse than none.
 */
import type { Observation } from 'fhir/r4';
import { LOINC, UCUM, codings, effectiveTime, hasCode, roundHalfUp, toDate } from './fhir';

// ---- scoring (RCP NEWS2 chart, 2017) ----------------------------------------------------------

export type Consciousness = 'alert' | 'new-confusion' | 'voice' | 'pain' | 'unresponsive' | 'not-alert';

export interface News2Inputs {
  respRate: number; // breaths per minute
  spo2: number; // %
  onOxygen: boolean;
  systolic: number; // mmHg
  pulse: number; // beats per minute
  consciousness: Consciousness;
  temp: number; // °C
}

export type Param = 'respRate' | 'spo2' | 'air' | 'systolic' | 'pulse' | 'consciousness' | 'temp';
export type Points = 0 | 1 | 2 | 3;
export type Risk = 'low' | 'low-medium' | 'medium' | 'high';

export interface Score {
  total: number;
  points: Record<Param, Points>;
  risk: Risk;
  response: string;
  frequency: string;
}

export const PARAMS: Param[] = ['respRate', 'spo2', 'air', 'systolic', 'pulse', 'consciousness', 'temp'];

const band = (v: number, cuts: Array<[number, Points]>, top: Points): Points => {
  for (const [max, pts] of cuts) if (v <= max) return pts;
  return top;
};

export const respRatePoints = (rr: number): Points => band(rr, [[8, 3], [11, 1], [20, 0], [24, 2]], 3);
export const systolicPoints = (sbp: number): Points => band(sbp, [[90, 3], [100, 2], [110, 1], [219, 0]], 3);
export const pulsePoints = (hr: number): Points => band(hr, [[40, 3], [50, 1], [90, 0], [110, 1], [130, 2]], 3);
export const tempPoints = (t: number): Points => band(roundHalfUp(t, 1), [[35.0, 3], [36.0, 1], [38.0, 0], [39.0, 1]], 2);

/** SpO2 scale 1: the default. */
export const spo2Scale1Points = (s: number): Points => band(s, [[91, 3], [93, 2], [95, 1]], 0);

/**
 * SpO2 scale 2: only for patients with confirmed hypercapnic respiratory failure and a
 * prescribed target of 88-92%, decided by a clinician. Above 92% scores only on oxygen.
 */
export const spo2Scale2Points = (s: number, onOxygen: boolean): Points => {
  if (s <= 83) return 3;
  if (s <= 85) return 2;
  if (s <= 87) return 1;
  if (s <= 92 || !onOxygen) return 0;
  return band(s, [[94, 1], [96, 2]], 3);
};

export function score(o: News2Inputs, spo2Scale: 1 | 2 = 1): Score {
  const points: Record<Param, Points> = {
    respRate: respRatePoints(o.respRate),
    spo2: spo2Scale === 2 ? spo2Scale2Points(o.spo2, o.onOxygen) : spo2Scale1Points(o.spo2),
    air: o.onOxygen ? 2 : 0,
    systolic: systolicPoints(o.systolic),
    pulse: pulsePoints(o.pulse),
    consciousness: o.consciousness === 'alert' ? 0 : 3,
    temp: tempPoints(o.temp),
  };
  const total = Object.values(points).reduce<number>((a, b) => a + b, 0);
  const single3 = Object.values(points).some((p) => p === 3);
  const risk: Risk = total >= 7 ? 'high' : total >= 5 ? 'medium' : single3 ? 'low-medium' : 'low';
  return { total, points, risk, ...RESPONSE[risk === 'low' && total === 0 ? 'zero' : risk] };
}

export const RESPONSE: Record<Risk | 'zero', { response: string; frequency: string }> = {
  zero: { response: 'Continue routine monitoring.', frequency: 'Observations at least every 12 hours' },
  low: { response: 'Inform the nurse in charge, who decides whether to increase monitoring or escalate.', frequency: 'Observations at least every 4 to 6 hours' },
  'low-medium': { response: 'Urgent ward-based response: a clinician reviews the patient and decides whether to escalate.', frequency: 'Observations at least every hour' },
  medium: { response: 'Urgent response: inform the medical team and request an urgent assessment by a clinician skilled in acute illness.', frequency: 'Observations at least every hour' },
  high: { response: 'Emergency response: immediate assessment by a team with critical care skills, usually transfer to a higher level of care.', frequency: 'Continuous monitoring of vital signs' },
};

export const RISK_LABEL: Record<Risk, string> = {
  low: 'Low clinical risk',
  'low-medium': 'Low-medium clinical risk',
  medium: 'Medium clinical risk',
  high: 'High clinical risk',
};

export const PARAM_LABEL: Record<Param, string> = {
  respRate: 'Respiration rate',
  spo2: 'SpO₂',
  air: 'Air or oxygen',
  systolic: 'Systolic BP',
  pulse: 'Pulse',
  consciousness: 'Consciousness',
  temp: 'Temperature',
};

// ---- reading FHIR -----------------------------------------------------------------------------

/**
 * The LOINC codes read for each parameter. Every code was checked against LOINC 2.82 (all
 * ACTIVE); the vital sign codes are the ones the FHIR R4 vital signs profiles require.
 */
export const NEWS2_CODES = {
  respRate: ['9279-1'], // Respiratory rate
  spo2: ['2708-6', '59408-5'], // Oxygen saturation in Arterial blood; ... by Pulse oximetry
  bpPanel: ['85354-9'], // Blood pressure panel with all children optional
  systolic: ['8480-6'], // Systolic blood pressure, on its own or as a component of 85354-9
  pulse: ['8867-4'], // Heart rate
  temp: ['8310-5'], // Body temperature
  consciousness: ['67775-7', '80288-4'], // Level of responsiveness (AVPU answers); Level of consciousness
  oxygenFlow: ['3151-8'], // Inhaled oxygen flow rate
  oxygenConcentration: ['3150-0'], // Inhaled oxygen concentration
  oxygenUse: ['88658-0'], // Use of supplemental oxygen
} as const;

/**
 * LOINC answers for consciousness. LL1845-8 (for 67775-7) is AVPU; LL3828-2 (for 80288-4) adds
 * Confused, Lethargic, Obtunded and Stuporous. Only Alert scores 0. An answer not listed here makes
 * the parameter unreadable rather than being scored as either.
 */
export const CONSCIOUSNESS_ANSWERS: Record<string, { level: Consciousness; label: string }> = {
  'LA9340-6': { level: 'alert', label: 'Alert' },
  'LA6560-2': { level: 'new-confusion', label: 'Confused' },
  'LA17108-4': { level: 'voice', label: 'Responds to voice' },
  'LA17107-6': { level: 'pain', label: 'Responds to pain' },
  'LA9343-0': { level: 'unresponsive', label: 'Unresponsive' },
  'LA25161-3': { level: 'not-alert', label: 'Lethargic' },
  'LA25162-1': { level: 'not-alert', label: 'Obtunded' },
  'LA25163-9': { level: 'not-alert', label: 'Stuporous' },
};

/** LL4908-1, the answers for 88658-0. Every one of them means the patient is on oxygen. */
export const OXYGEN_USE_ANSWERS: Record<string, string> = {
  'LA28684-1': 'Continuously depending on high oxygen flow',
  'LA28685-8': 'Continuously depending on low oxygen flow',
  'LA28686-6': 'Intermittent oxygen consumption',
};

const UNITS: Record<'respRate' | 'spo2' | 'systolic' | 'pulse', string[]> = {
  respRate: ['/min', '{breaths}/min', '{counts}/min'],
  spo2: ['%'],
  systolic: ['mm[Hg]'],
  pulse: ['/min', '{beats}/min', '{counts}/min'],
};

export type ReadingState =
  | { state: 'ok'; time: Date; recorded: string; used: string; rounded: boolean; note?: string }
  | { state: 'missing'; reason: string };

export interface ParamReading {
  param: Param;
  reading: ReadingState;
  points?: Points;
}

export type News2Result =
  | { complete: true; score: Score; params: ParamReading[]; spo2Scale: 1 | 2 }
  | { complete: false; params: ParamReading[]; missing: Param[]; spo2Scale: 1 | 2; red: Param[] };

export interface News2Options {
  now: Date | string;
  /** Readings older than this are stale and do not count. */
  maxAgeMinutes: number;
  /** Scale 2 only when a clinician has prescribed it for hypercapnic respiratory failure. */
  spo2Scale?: 1 | 2;
}

const USABLE_STATUS = new Set(['final', 'amended', 'corrected', 'preliminary']);

interface Candidate { o: Observation; time: Date | undefined; quantity?: Observation['valueQuantity']; concept?: Observation['valueCodeableConcept']; absent?: string }

function candidates(observations: Observation[], codes: readonly string[]): Candidate[] {
  const out: Candidate[] = [];
  for (const o of observations) {
    if (!USABLE_STATUS.has(o.status)) continue;
    if (hasCode(o.code, LOINC, codes)) {
      out.push({ o, time: effectiveTime(o), quantity: o.valueQuantity, concept: o.valueCodeableConcept, absent: absentText(o.dataAbsentReason) });
    }
  }
  return out;
}

/** Systolic from a 85354-9 panel component, or a standalone 8480-6 Observation. */
function systolicCandidates(observations: Observation[]): Candidate[] {
  const out = candidates(observations, NEWS2_CODES.systolic);
  for (const o of observations) {
    if (!USABLE_STATUS.has(o.status) || !hasCode(o.code, LOINC, NEWS2_CODES.bpPanel)) continue;
    const c = o.component?.find((x) => hasCode(x.code, LOINC, NEWS2_CODES.systolic));
    if (!c) continue;
    out.push({ o, time: effectiveTime(o), quantity: c.valueQuantity, absent: absentText(c.dataAbsentReason ?? o.dataAbsentReason) });
  }
  return out;
}

function absentText(cc: Observation['dataAbsentReason']): string | undefined {
  if (!cc) return undefined;
  const display = codings(cc).find((c) => c.display)?.display ?? codings(cc)[0]?.code;
  return [display, cc.text].filter(Boolean).join(': ') || 'Data absent';
}

/** The most recent candidate decides. An older value is never used to fill in for a newer failed one. */
function latest(cs: Candidate[]): Candidate | 'no-time' | undefined {
  if (cs.length === 0) return undefined;
  const timed = cs.filter((c) => c.time);
  if (timed.length === 0) return 'no-time';
  return timed.reduce((a, b) => (b.time!.getTime() > a.time!.getTime() ? b : a));
}

interface Checked { time: Date; c: Candidate }

function check(cs: Candidate[], opts: News2Options): Checked | { reason: string } {
  const c = latest(cs);
  if (c === undefined) return { reason: 'No observation recorded' };
  if (c === 'no-time') return { reason: 'Observation has no time' };
  const now = toDate(opts.now);
  const time = c.time!;
  if (time.getTime() > now.getTime()) return { reason: 'Observation time is after now' };
  const ageMin = (now.getTime() - time.getTime()) / 60000;
  if (ageMin > opts.maxAgeMinutes) return { reason: `Stale: last recorded ${Math.floor(ageMin)} min ago (limit ${opts.maxAgeMinutes} min)` };
  if (c.absent) return { reason: `Not measured: ${c.absent}` };
  return { time, c };
}

function quantityReading(cs: Candidate[], opts: News2Options, units: string[], places: number, unitLabel: string): { reading: ReadingState; value?: number } {
  const r = check(cs, opts);
  if ('reason' in r) return { reading: { state: 'missing', reason: r.reason } };
  const q = r.c.quantity;
  if (q?.value === undefined) return { reading: { state: 'missing', reason: 'Observation has no value' } };
  if (q.comparator) return { reading: { state: 'missing', reason: `Value is ${q.comparator}${q.value}, not an exact reading` } };
  if (q.system !== UCUM || !q.code || !units.includes(q.code)) return { reading: { state: 'missing', reason: `Unit ${q.code ?? q.unit ?? 'not recorded'} is not supported` } };
  const used = roundHalfUp(q.value, places);
  return {
    value: used,
    reading: { state: 'ok', time: r.time, recorded: `${q.value}`, used: `${used} ${unitLabel}`.trim(), rounded: used !== q.value },
  };
}

function temperatureReading(cs: Candidate[], opts: News2Options): { reading: ReadingState; value?: number } {
  const r = check(cs, opts);
  if ('reason' in r) return { reading: { state: 'missing', reason: r.reason } };
  const q = r.c.quantity;
  if (q?.value === undefined) return { reading: { state: 'missing', reason: 'Observation has no value' } };
  if (q.comparator) return { reading: { state: 'missing', reason: `Value is ${q.comparator}${q.value}, not an exact reading` } };
  if (q.system !== UCUM || (q.code !== 'Cel' && q.code !== '[degF]')) return { reading: { state: 'missing', reason: `Unit ${q.code ?? q.unit ?? 'not recorded'} is not supported` } };
  const celsius = q.code === 'Cel' ? q.value : ((q.value - 32) * 5) / 9;
  const used = roundHalfUp(celsius, 1);
  const recorded = q.code === 'Cel' ? `${q.value}` : `${q.value} °F`;
  return {
    value: used,
    reading: { state: 'ok', time: r.time, recorded, used: `${used} °C`, rounded: q.code !== 'Cel' || used !== q.value, note: q.code === '[degF]' ? 'converted from °F' : undefined },
  };
}

function consciousnessReading(cs: Candidate[], opts: News2Options): { reading: ReadingState; value?: Consciousness } {
  const r = check(cs, opts);
  if ('reason' in r) return { reading: { state: 'missing', reason: r.reason } };
  const answer = codings(r.c.concept).find((c) => c.system === LOINC && c.code && CONSCIOUSNESS_ANSWERS[c.code]);
  if (!answer?.code) return { reading: { state: 'missing', reason: 'Answer is not a recognised LOINC consciousness code' } };
  const a = CONSCIOUSNESS_ANSWERS[answer.code]!;
  const note = a.level === 'new-confusion' ? 'scored as new confusion' : undefined;
  return { value: a.level, reading: { state: 'ok', time: r.time, recorded: a.label, used: a.label, rounded: false, note } };
}

/**
 * Air or oxygen, from the most recent of: inhaled oxygen flow (0 L/min is air), inhaled oxygen
 * concentration (21% is air) or use of supplemental oxygen (any LL4908-1 answer is oxygen).
 * There is no default: without one of these, the parameter is missing.
 */
function oxygenReading(observations: Observation[], opts: News2Options): { reading: ReadingState; value?: boolean } {
  const cs = candidates(observations, [...NEWS2_CODES.oxygenFlow, ...NEWS2_CODES.oxygenConcentration, ...NEWS2_CODES.oxygenUse]);
  const r = check(cs, opts);
  if ('reason' in r) return { reading: { state: 'missing', reason: r.reason === 'No observation recorded' ? 'No air or oxygen record (room air is not assumed)' : r.reason } };
  const { o, quantity: q, concept } = r.c;
  const ok = (onOxygen: boolean, recorded: string): { reading: ReadingState; value: boolean } => ({
    value: onOxygen,
    reading: { state: 'ok', time: r.time, recorded, used: onOxygen ? 'Oxygen' : 'Air', rounded: false },
  });
  if (hasCode(o.code, LOINC, NEWS2_CODES.oxygenUse)) {
    const answer = codings(concept).find((c) => c.system === LOINC && c.code && OXYGEN_USE_ANSWERS[c.code]);
    if (!answer?.code) return { reading: { state: 'missing', reason: 'Answer is not a recognised LOINC oxygen use code' } };
    return ok(true, OXYGEN_USE_ANSWERS[answer.code]!);
  }
  if (q?.value === undefined || q.comparator) return { reading: { state: 'missing', reason: 'Oxygen record has no exact value' } };
  if (hasCode(o.code, LOINC, NEWS2_CODES.oxygenFlow)) {
    if (q.system !== UCUM || q.code !== 'L/min') return { reading: { state: 'missing', reason: `Unit ${q.code ?? q.unit ?? 'not recorded'} is not supported` } };
    if (q.value < 0) return { reading: { state: 'missing', reason: 'Negative oxygen flow' } };
    return ok(q.value > 0, `${q.value} L/min`);
  }
  if (q.system !== UCUM || q.code !== '%') return { reading: { state: 'missing', reason: `Unit ${q.code ?? q.unit ?? 'not recorded'} is not supported` } };
  if (q.value < 21 || q.value > 100) return { reading: { state: 'missing', reason: `Inhaled oxygen ${q.value}% is outside 21 to 100%` } };
  return ok(q.value > 21, `${q.value}% inhaled oxygen`);
}

export function news2FromObservations(observations: Observation[], opts: News2Options): News2Result {
  const spo2Scale = opts.spo2Scale ?? 1;
  const rr = quantityReading(candidates(observations, NEWS2_CODES.respRate), opts, UNITS.respRate, 0, '/min');
  const spo2 = quantityReading(candidates(observations, NEWS2_CODES.spo2), opts, UNITS.spo2, 0, '%');
  const air = oxygenReading(observations, opts);
  const sbp = quantityReading(systolicCandidates(observations), opts, UNITS.systolic, 0, 'mmHg');
  const hr = quantityReading(candidates(observations, NEWS2_CODES.pulse), opts, UNITS.pulse, 0, '/min');
  const avpu = consciousnessReading(candidates(observations, NEWS2_CODES.consciousness), opts);
  const temp = temperatureReading(candidates(observations, NEWS2_CODES.temp), opts);

  // Points for each parameter that has a value. SpO2 on scale 2 also needs to know about oxygen.
  const pts: Partial<Record<Param, Points>> = {};
  if (rr.value !== undefined) pts.respRate = respRatePoints(rr.value);
  if (spo2.value !== undefined) {
    if (spo2Scale === 1) pts.spo2 = spo2Scale1Points(spo2.value);
    else if (air.value !== undefined) pts.spo2 = spo2Scale2Points(spo2.value, air.value);
  }
  if (air.value !== undefined) pts.air = air.value ? 2 : 0;
  if (sbp.value !== undefined) pts.systolic = systolicPoints(sbp.value);
  if (hr.value !== undefined) pts.pulse = pulsePoints(hr.value);
  if (avpu.value !== undefined) pts.consciousness = avpu.value === 'alert' ? 0 : 3;
  if (temp.value !== undefined) pts.temp = tempPoints(temp.value);

  const readings: Record<Param, ReadingState> = {
    respRate: rr.reading, spo2: spo2.reading, air: air.reading, systolic: sbp.reading, pulse: hr.reading, consciousness: avpu.reading, temp: temp.reading,
  };
  const params: ParamReading[] = PARAMS.map((param) => ({ param, reading: readings[param], points: pts[param] }));
  const missing = PARAMS.filter((p) => readings[p].state === 'missing');

  if (missing.length > 0 || pts.spo2 === undefined) {
    const red = PARAMS.filter((p) => pts[p] === 3);
    return { complete: false, params, missing, spo2Scale, red };
  }
  const s = score(
    { respRate: rr.value!, spo2: spo2.value!, onOxygen: air.value!, systolic: sbp.value!, pulse: hr.value!, consciousness: avpu.value!, temp: temp.value! },
    spo2Scale,
  );
  return { complete: true, score: s, params, spo2Scale };
}
