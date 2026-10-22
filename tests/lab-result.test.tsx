import { render, screen } from '@testing-library/react';
import type { Observation } from 'fhir/r4';
import { describe, expect, it } from 'vitest';
import { LabResult } from '@/components/wardkit/lab-result';
import { clone, expectNoAxeViolations, fixture } from './helpers';

const lab = (name: string) => clone(fixture<Observation>(`lab-${name}.json`));
const show = (o: Observation) => render(<LabResult observation={o} timeZone="Europe/Vienna" />);

describe('LabResult interpretation flags', () => {
  it.each([
    ['crp-high', 'High'],
    ['sodium-low', 'Low'],
    ['potassium-critical-high', 'Critically high'],
    ['glucose-critical-low', 'Critically low'],
    ['nitrite-abnormal', 'Abnormal'],
    ['wcc-normal', 'Normal'],
  ])('%s shows the flag as text: %s', async (name, label) => {
    const { container } = show(lab(name));
    expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('never derives a flag from the reference range', () => {
    const o = lab('crp-high');
    delete o.interpretation;
    show(o);
    expect(screen.getByText('148 mg/L')).toBeInTheDocument();
    expect(screen.queryByText('High')).not.toBeInTheDocument();
  });

  it('shows an unknown interpretation code as its own text, not as a known flag', () => {
    const o = lab('crp-high');
    o.interpretation = [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'W', display: 'Worse' }] }];
    show(o);
    expect(screen.getByText('Worse')).toBeInTheDocument();
  });
});

describe('LabResult values and ranges', () => {
  it('shows value, unit and reference range', () => {
    show(lab('potassium-critical-high'));
    expect(screen.getByText('6.9 mmol/L')).toBeInTheDocument();
    expect(screen.getByText('3.5 to 5.1 mmol/L (Adult)')).toBeInTheDocument();
  });

  it('keeps the comparator: "<5", not "5"', () => {
    show(lab('crp-below-limit'));
    expect(screen.getByText('<5 mg/L')).toBeInTheDocument();
  });

  it('shows a one-sided range in words', () => {
    show(lab('crp-high'));
    expect(screen.getByText('5 mg/L or less (Adult)')).toBeInTheDocument();
  });

  it('shows a coded value', () => {
    show(lab('nitrite-abnormal'));
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });

  it('shows the dataAbsentReason, never a blank or a zero', async () => {
    const { container } = show(lab('potassium-haemolysed'));
    expect(screen.getByText(/Error\. Sample haemolysed, potassium not reported/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b0 mmol/);
    await expectNoAxeViolations(container);
  });

  it('says so when there is no value and no reason', () => {
    const o = lab('wcc-normal');
    delete o.valueQuantity;
    show(o);
    expect(screen.getByText('No value recorded.')).toBeInTheDocument();
  });
});

describe('LabResult status', () => {
  it('marks a preliminary result', () => {
    show(lab('lactate-preliminary'));
    expect(screen.getByText('Preliminary, may change')).toBeInTheDocument();
    expect(screen.getByText('3.1 mmol/L')).toBeInTheDocument();
  });

  it('marks an amended result as changed', () => {
    show(lab('creatinine-amended'));
    expect(screen.getByText('Amended: changed after first report')).toBeInTheDocument();
  });

  it('marks a corrected result as changed', () => {
    show(lab('potassium-corrected'));
    expect(screen.getByText('Corrected: changed after first report')).toBeInTheDocument();
  });

  it('never shows an entered-in-error result as valid: no value, no flag', async () => {
    const { container } = show(lab('crp-entered-in-error'));
    expect(screen.getByText('Entered in error')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/14/);
    expect(screen.queryByText('High')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows a registered test as pending', () => {
    show(lab('haemoglobin-registered'));
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows a cancelled test without a result', () => {
    show(lab('haemoglobin-cancelled'));
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('a final result has no status badge', () => {
    show(lab('wcc-normal'));
    expect(screen.queryByText(/Preliminary|Amended|Corrected/)).not.toBeInTheDocument();
  });

  it('shows the result time in the given time zone', () => {
    show(lab('wcc-normal'));
    expect(screen.getByText('21 Oct 2026, 00:40')).toBeInTheDocument();
  });
});
