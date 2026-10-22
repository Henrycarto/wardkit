import { render, screen, within } from '@testing-library/react';
import type { Observation } from 'fhir/r4';
import { describe, expect, it } from 'vitest';
import { VitalsTrend, trendModel } from '@/components/wardkit/vitals-trend';
import { clone, expectNoAxeViolations, observations } from './helpers';

const night = () => clone(observations('vitals-heart-rate-night.json'));
const hhmm = (d: Date) => d.toISOString().slice(11, 16); // UTC; the fixture is at +02:00

describe('VitalsTrend gaps', () => {
  it('breaks the line at a dataAbsentReason and at an entered-in-error reading', () => {
    const m = trendModel(night());
    expect(m.segments.map((s) => s.length)).toEqual([4, 6, 3]);
    expect(m.gaps.map((g) => g.reason)).toEqual(['Not measured: Error: Probe off, no valid reading', 'Entered in error, not shown']);
  });

  it('never interpolates: every point on the line is a recorded value', () => {
    const m = trendModel(night());
    const plotted = m.segments.flat().map((p) => p.value);
    expect(plotted).toEqual([88, 89, 90, 90, 90, 104, 112, 118, 124, 116, 108, 98, 96]);
    expect(plotted).not.toContain(160); // the entered-in-error value
  });

  it('breaks the line when readings are further apart than maxGapMinutes', () => {
    const m = trendModel(night(), { maxGapMinutes: 120 });
    expect(m.longGaps).toHaveLength(1);
    expect([hhmm(m.longGaps[0]!.from), hhmm(m.longGaps[0]!.to), m.longGaps[0]!.minutes]).toEqual(['01:00', '04:00', 180]);
    expect(m.segments.map((s) => s.length)).toEqual([4, 6, 1, 2]);
  });

  it('without maxGapMinutes only recorded gaps break the line', () => {
    expect(trendModel(night()).longGaps).toEqual([]);
  });

  it('treats an inexact value as a gap, not a point', () => {
    const obs = night();
    obs[1]!.valueQuantity!.comparator = '>';
    const m = trendModel(obs);
    expect(m.gaps[0]!.reason).toBe('Value >89 is not exact, not plotted');
    expect(m.segments[0]).toHaveLength(1);
  });

  it('draws one polyline per segment and marks each gap', async () => {
    const { container } = render(<VitalsTrend observations={night()} maxGapMinutes={120} timeZone="Europe/Vienna" />);
    expect(container.querySelectorAll('polyline')).toHaveLength(4);
    expect(screen.getByText('3 gaps, line not joined across', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/13 readings, latest 96 \/min, 3 gaps/);
    await expectNoAxeViolations(container);
  });
});

describe('VitalsTrend input checks', () => {
  it('refuses to plot readings of different vital signs together', () => {
    const obs = night();
    obs[0]!.code = { coding: [{ system: 'http://loinc.org', code: '9279-1', display: 'Respiratory rate' }] };
    render(<VitalsTrend observations={obs} />);
    expect(screen.getByRole('alert')).toHaveTextContent('2 different codes');
  });

  it('refuses to mix units', () => {
    const obs = night();
    obs[0]!.valueQuantity = { value: 1.5, unit: 'Hz', system: 'http://unitsofmeasure.org', code: 'Hz' };
    render(<VitalsTrend observations={obs} />);
    expect(screen.getByRole('alert')).toHaveTextContent('2 different units');
  });

  it('counts readings without a time and does not place them', () => {
    const obs = night();
    delete obs[0]!.effectiveDateTime;
    const m = trendModel(obs);
    expect(m.untimed).toBe(1);
    expect(m.segments.flat()).toHaveLength(12);
  });

  it('shades the reference range from the latest reading that has one', () => {
    expect(trendModel(night()).range).toMatchObject({ low: 51, high: 90 });
  });

  it('plots a component, such as systolic from a blood pressure panel', () => {
    const bp: Observation[] = ['06:00', '07:00'].map((t, i) => ({
      resourceType: 'Observation', status: 'final', effectiveDateTime: `2026-10-21T${t}:00+02:00`,
      code: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
      component: [
        { code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: 120 + i, code: 'mm[Hg]' } },
        { code: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] }, valueQuantity: { value: 80, code: 'mm[Hg]' } },
      ],
    }));
    expect(trendModel(bp, { componentCode: '8480-6' }).segments[0]!.map((p) => p.value)).toEqual([120, 121]);
  });

  it('lists every reading and gap in the table', () => {
    render(<VitalsTrend observations={night()} timeZone="Europe/Vienna" />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(16); // header + 15
    expect(within(table).getByText('Not measured: Error: Probe off, no valid reading')).toBeInTheDocument();
    expect(within(table).getByText('Entered in error, not shown')).toBeInTheDocument();
  });
});
