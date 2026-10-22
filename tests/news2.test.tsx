import { render, screen } from '@testing-library/react';
import type { Observation } from 'fhir/r4';
import { describe, expect, it } from 'vitest';
import { News2Panel } from '@/components/wardkit/news2-panel';
import {
  news2FromObservations, pulsePoints, respRatePoints, score, spo2Scale1Points, spo2Scale2Points, systolicPoints, tempPoints,
  type News2Inputs, type News2Result,
} from '@/lib/wardkit/news2';
import { clone, expectNoAxeViolations, observations } from './helpers';

// ---- scoring: ported from the ward monitor ----------------------------------------------------

// Band edges straight from the RCP NEWS2 chart, both sides of every boundary.
describe('NEWS2 parameter bands', () => {
  it.each([[8, 3], [9, 1], [11, 1], [12, 0], [20, 0], [21, 2], [24, 2], [25, 3]])('respiration %i -> %i', (v, p) => expect(respRatePoints(v)).toBe(p));
  it.each([[91, 3], [92, 2], [93, 2], [94, 1], [95, 1], [96, 0]])('SpO2 scale 1 %i -> %i', (v, p) => expect(spo2Scale1Points(v)).toBe(p));
  it.each([[90, 3], [91, 2], [100, 2], [101, 1], [110, 1], [111, 0], [219, 0], [220, 3]])('systolic %i -> %i', (v, p) => expect(systolicPoints(v)).toBe(p));
  it.each([[40, 3], [41, 1], [50, 1], [51, 0], [90, 0], [91, 1], [110, 1], [111, 2], [130, 2], [131, 3]])('pulse %i -> %i', (v, p) => expect(pulsePoints(v)).toBe(p));
  it.each([[35.0, 3], [35.1, 1], [36.0, 1], [36.1, 0], [38.0, 0], [38.1, 1], [39.0, 1], [39.1, 2]])('temperature %f -> %i', (v, p) => expect(tempPoints(v)).toBe(p));

  it('SpO2 scale 2 scores high saturations only when on oxygen', () => {
    expect([83, 84, 85, 86, 87, 88, 92].map((s) => spo2Scale2Points(s, true))).toEqual([3, 2, 2, 1, 1, 0, 0]);
    expect([93, 94, 95, 96, 97].map((s) => spo2Scale2Points(s, true))).toEqual([1, 1, 2, 2, 3]);
    expect(spo2Scale2Points(97, false)).toBe(0);
  });

  it('temperature rounds half up to one decimal: 36.05 is 36.1 and scores 0, 35.95 is 36.0 and scores 1', () => {
    expect(tempPoints(36.05)).toBe(0);
    expect(tempPoints(35.95)).toBe(1);
  });
});

const normal: News2Inputs = { respRate: 16, spo2: 97, onOxygen: false, systolic: 125, pulse: 72, consciousness: 'alert', temp: 36.8 };

describe('NEWS2 aggregate and risk bands', () => {
  it('0 is low risk with routine monitoring every 12 hours', () => {
    const s = score(normal);
    expect([s.total, s.risk]).toEqual([0, 'low']);
    expect(s.frequency).toMatch(/12 hours/);
  });
  it('1 is low risk, every 4 to 6 hours', () => {
    const s = score({ ...normal, temp: 38.5 });
    expect([s.total, s.risk]).toEqual([1, 'low']);
    expect(s.frequency).toMatch(/4 to 6 hours/);
  });
  it('4 without a single 3 is still low', () => {
    const s = score({ ...normal, respRate: 22, onOxygen: true }); // 2 + 2
    expect([s.total, s.risk]).toEqual([4, 'low']);
  });
  it('a single 3 makes the risk low-medium even when the total is low', () => {
    const s = score({ ...normal, pulse: 135 });
    expect([s.total, s.risk]).toEqual([3, 'low-medium']);
    expect(s.response).toMatch(/Urgent ward-based response/);
  });
  it('5 is medium', () => {
    expect(score({ ...normal, respRate: 22, onOxygen: true, temp: 38.5 })).toMatchObject({ total: 5, risk: 'medium' });
  });
  it('6 is medium', () => {
    expect(score({ ...normal, respRate: 22, onOxygen: true, systolic: 100 })).toMatchObject({ total: 6, risk: 'medium' });
  });
  it('7 is high', () => {
    expect(score({ ...normal, respRate: 22, onOxygen: true, systolic: 100, temp: 38.5 })).toMatchObject({ total: 7, risk: 'high' });
  });
  it('new confusion alone scores 3', () => {
    expect(score({ ...normal, consciousness: 'new-confusion' }).points.consciousness).toBe(3);
  });
  it('a COPD patient at target on scale 2 scores only for the oxygen', () => {
    const o = { ...normal, spo2: 90, onOxygen: true };
    expect(score(o, 2).total).toBe(2);
    expect(score(o, 1).total).toBe(5); // the same patient on the wrong scale would trigger an urgent response
  });
});

// ---- reading FHIR -----------------------------------------------------------------------------

const AT_0100 = '2026-10-21T01:00:00+02:00';
const AT_0600 = '2026-10-21T06:00:00+02:00';
const opts = (now = AT_0600, maxAgeMinutes = 60) => ({ now, maxAgeMinutes });

const set = (name: string) => clone(observations(name));
const byId = (obs: Observation[], suffix: string) => obs.find((o) => o.id!.endsWith(suffix))!;
const param = (r: News2Result, p: string) => r.params.find((x) => x.param === p)!;

describe('NEWS2 from FHIR Observations', () => {
  it('scores the Bed 3 set at 01:00 as 17, high risk', () => {
    const r = news2FromObservations(set('news2-huber-0100.json'), opts(AT_0100));
    expect(r.complete).toBe(true);
    if (r.complete) expect(r.score).toMatchObject({ total: 17, risk: 'high' });
  });

  it('scores a normal set as 0', () => {
    const r = news2FromObservations(set('news2-normal.json'), opts());
    expect(r.complete && r.score.total).toBe(0);
  });

  it('uses scale 2 only when asked', () => {
    const obs = set('news2-copd-scale2.json');
    const s1 = news2FromObservations(obs, opts());
    const s2 = news2FromObservations(obs, { ...opts(), spo2Scale: 2 });
    expect(s1.complete && s1.score.total).toBe(5);
    expect(s2.complete && s2.score.total).toBe(2);
  });

  it('is incomplete without an air or oxygen record: room air is never assumed', () => {
    const obs = set('news2-normal.json').filter((o) => !o.id!.endsWith('-o2'));
    const r = news2FromObservations(obs, opts());
    expect(r.complete).toBe(false);
    if (!r.complete) expect(r.missing).toEqual(['air']);
    expect(param(r, 'air').reading).toMatchObject({ state: 'missing', reason: expect.stringMatching(/room air is not assumed/) });
  });

  it('is incomplete when a reading is older than the window', () => {
    const r = news2FromObservations(set('news2-normal.json'), opts('2026-10-21T07:01:00+02:00', 60));
    expect(r.complete).toBe(false);
    expect(param(r, 'pulse').reading).toMatchObject({ state: 'missing', reason: expect.stringMatching(/^Stale: last recorded 61 min ago/) });
  });

  it('accepts a reading exactly at the window limit', () => {
    expect(news2FromObservations(set('news2-normal.json'), opts('2026-10-21T07:00:00+02:00', 60)).complete).toBe(true);
  });

  it('rejects a reading timed after now', () => {
    const r = news2FromObservations(set('news2-normal.json'), opts('2026-10-21T05:59:00+02:00'));
    expect(param(r, 'respRate').reading).toMatchObject({ state: 'missing', reason: 'Observation time is after now' });
  });

  it('does not fall back to an older value when the latest reading has a dataAbsentReason', () => {
    const obs = set('news2-normal.json');
    const failed = clone(byId(obs, '-hr'));
    failed.id = 'n2-normal-hr-failed';
    failed.effectiveDateTime = '2026-10-21T06:20:00+02:00';
    delete failed.valueQuantity;
    failed.dataAbsentReason = { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'error', display: 'Error' }], text: 'Probe off' };
    const r = news2FromObservations([...obs, failed], opts('2026-10-21T06:30:00+02:00'));
    expect(r.complete).toBe(false);
    expect(param(r, 'pulse').reading).toMatchObject({ state: 'missing', reason: 'Not measured: Error: Probe off' });
  });

  it('ignores a reading entered in error', () => {
    const obs = set('news2-normal.json');
    const wrong = clone(byId(obs, '-hr'));
    wrong.id = 'n2-normal-hr-wrong';
    wrong.status = 'entered-in-error';
    wrong.effectiveDateTime = '2026-10-21T06:10:00+02:00';
    wrong.valueQuantity!.value = 150;
    const r = news2FromObservations([...obs, wrong], opts('2026-10-21T06:30:00+02:00'));
    expect(r.complete && r.score.points.pulse).toBe(0);
  });

  it('rounds RR 11.5 to 12 across the band edge (0 points, not 1) and says so', () => {
    const obs = set('news2-normal.json');
    byId(obs, '-rr').valueQuantity!.value = 11.5;
    const r = news2FromObservations(obs, opts());
    expect(param(r, 'respRate')).toMatchObject({ points: 0, reading: { state: 'ok', used: '12 /min', recorded: '11.5', rounded: true } });
    byId(obs, '-rr').valueQuantity!.value = 11.4;
    expect(param(news2FromObservations(obs, opts()), 'respRate').points).toBe(1);
  });

  it('rounds systolic 90.4 to 90 (3 points) and 90.5 to 91 (2 points)', () => {
    const obs = set('news2-normal.json');
    const sbp = byId(obs, '-bp').component![0]!.valueQuantity!;
    sbp.value = 90.4;
    expect(param(news2FromObservations(obs, opts()), 'systolic').points).toBe(3);
    sbp.value = 90.5;
    expect(param(news2FromObservations(obs, opts()), 'systolic').points).toBe(2);
  });

  it('marks a whole-number value as not rounded', () => {
    expect(param(news2FromObservations(set('news2-normal.json'), opts()), 'respRate').reading).toMatchObject({ rounded: false });
  });

  it('converts Fahrenheit and shows what was recorded', () => {
    const obs = set('news2-normal.json');
    byId(obs, '-temp').valueQuantity = { value: 101.3, unit: '°F', system: 'http://unitsofmeasure.org', code: '[degF]' };
    const t = param(news2FromObservations(obs, opts()), 'temp');
    expect(t).toMatchObject({ points: 1, reading: { used: '38.5 °C', recorded: '101.3 °F' } });
  });

  it('refuses an inexact value, an unsupported unit and an unknown consciousness answer', () => {
    const obs = set('news2-normal.json');
    byId(obs, '-spo2').valueQuantity!.comparator = '<';
    byId(obs, '-hr').valueQuantity!.code = 'Hz';
    byId(obs, '-avpu').valueCodeableConcept = { text: 'Drowsy' };
    const r = news2FromObservations(obs, opts());
    expect(r.complete).toBe(false);
    if (!r.complete) expect(r.missing).toEqual(['spo2', 'pulse', 'consciousness']);
  });

  it('reads systolic from a standalone 8480-6 Observation', () => {
    const obs = set('news2-normal.json');
    const panel = byId(obs, '-bp');
    const standalone: Observation = {
      resourceType: 'Observation', id: 'sbp', status: 'final', effectiveDateTime: panel.effectiveDateTime,
      code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: 88, system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
    };
    const r = news2FromObservations([...obs.filter((o) => o !== panel), standalone], opts());
    expect(param(r, 'systolic').points).toBe(3);
  });

  it('reads air or oxygen from inhaled oxygen concentration and from use of supplemental oxygen', () => {
    const obs = set('news2-normal.json');
    const o2 = byId(obs, '-o2');
    o2.code = { coding: [{ system: 'http://loinc.org', code: '3150-0' }] };
    o2.valueQuantity = { value: 21, system: 'http://unitsofmeasure.org', code: '%' };
    expect(param(news2FromObservations(obs, opts()), 'air').points).toBe(0);
    o2.valueQuantity.value = 28;
    expect(param(news2FromObservations(obs, opts()), 'air').points).toBe(2);
    o2.code = { coding: [{ system: 'http://loinc.org', code: '88658-0' }] };
    delete o2.valueQuantity;
    o2.valueCodeableConcept = { coding: [{ system: 'http://loinc.org', code: 'LA28685-8' }] };
    expect(param(news2FromObservations(obs, opts()), 'air').points).toBe(2);
  });

  it('scores Confused as 3 and labels it as new confusion', () => {
    const r = news2FromObservations(set('news2-huber-0100.json'), opts(AT_0100));
    expect(param(r, 'consciousness')).toMatchObject({ points: 3, reading: { used: 'Confused', note: 'scored as new confusion' } });
  });

  it('on scale 2 SpO2 cannot be scored without the oxygen record', () => {
    const obs = set('news2-copd-scale2.json').filter((o) => !o.id!.endsWith('-o2'));
    const r = news2FromObservations(obs, { ...opts(), spo2Scale: 2 });
    expect(r.complete).toBe(false);
    expect(param(r, 'spo2').points).toBeUndefined();
  });

  it('names a parameter already scoring 3 when the set is incomplete', () => {
    const obs = set('news2-huber-0100.json').filter((o) => !o.id!.endsWith('-temp'));
    const r = news2FromObservations(obs, opts(AT_0100));
    expect(r.complete).toBe(false);
    if (!r.complete) expect(r.red).toEqual(['respRate', 'spo2', 'consciousness']);
  });
});

describe('News2Panel', () => {
  it('shows the score, the risk band and the single-parameter rule', async () => {
    const { container } = render(<News2Panel observations={set('news2-huber-0100.json')} now={AT_0100} maxAgeMinutes={60} timeZone="Europe/Vienna" />);
    expect(screen.getByText('Score 17')).toBeInTheDocument();
    expect(screen.getByText('High clinical risk')).toBeInTheDocument();
    expect(screen.getByText(/Score of 3 in a single parameter: Respiration rate, SpO₂, Consciousness/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('says when a single 3 alone sets the risk to low-medium', () => {
    const obs = set('news2-normal.json');
    byId(obs, '-hr').valueQuantity!.value = 135;
    render(<News2Panel observations={obs} now={AT_0600} maxAgeMinutes={60} />);
    expect(screen.getByText('Low-medium clinical risk')).toBeInTheDocument();
    expect(screen.getByText(/This alone sets the risk to low-medium/)).toBeInTheDocument();
  });

  it('shows an incomplete set without a total and names what is missing', async () => {
    const obs = set('news2-normal.json').filter((o) => !o.id!.endsWith('-o2'));
    const { container } = render(<News2Panel observations={obs} now={AT_0600} maxAgeMinutes={60} />);
    expect(screen.getByText('Incomplete: no score')).toBeInTheDocument();
    expect(screen.getByText(/^Missing: Air or oxygen\./)).toBeInTheDocument();
    expect(screen.queryByText(/^Score \d/)).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows a rounded value next to what was recorded', () => {
    const obs = set('news2-normal.json');
    byId(obs, '-rr').valueQuantity!.value = 11.5;
    render(<News2Panel observations={obs} now={AT_0600} maxAgeMinutes={60} />);
    expect(screen.getByText('12 /min')).toBeInTheDocument();
    expect(screen.getByText(/\(recorded 11\.5\)/)).toBeInTheDocument();
  });
});
