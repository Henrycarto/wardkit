import { render, screen } from '@testing-library/react';
import type { Patient } from 'fhir/r4';
import { describe, expect, it } from 'vitest';
import { PatientBanner, ageOn } from '@/components/wardkit/patient-banner';
import { clone, expectNoAxeViolations, fixture } from './helpers';

const p = (name: string) => clone(fixture<Patient>(`patient-${name}.json`));
const NOW = '2026-10-22T09:00:00+02:00';
const show = (patient: Patient, now = NOW) => render(<PatientBanner patient={patient} now={now} timeZone="Europe/Vienna" />);

describe('PatientBanner', () => {
  it('uses the official name, not the usual or maiden name', async () => {
    const { container } = show(p('huber'));
    expect(screen.getByRole('heading')).toHaveTextContent('HUBER, Margarete Anna');
    expect(container).not.toHaveTextContent('Grete');
    expect(container).not.toHaveTextContent('Steiner');
    await expectNoAxeViolations(container);
  });

  it('shows date of birth with age', () => {
    show(p('huber'));
    expect(screen.getByText('Born 14 Mar 1955 (71 years)')).toBeInTheDocument();
  });

  it('counts the birthday itself: one day before, one year younger', () => {
    show(p('huber'), '2027-03-13T12:00:00+01:00');
    expect(screen.getByText('Born 14 Mar 1955 (71 years)')).toBeInTheDocument();
  });

  it('decides "today" in the given time zone', () => {
    // 23:30 UTC on 13 March is already 14 March in Vienna
    show(p('huber'), '2027-03-13T23:30:00Z');
    expect(screen.getByText('Born 14 Mar 1955 (72 years)')).toBeInTheDocument();
  });

  it('shows the official identifier with its system', () => {
    show(p('huber'));
    expect(screen.getByText('W4B-000317')).toBeInTheDocument();
    expect(screen.getByText('System: https://github.com/Henrycarto/wardkit/fixtures/sid/mrn')).toBeInTheDocument();
  });

  it('shows administrative gender, labelled as such', () => {
    show(p('huber'));
    expect(screen.getByText('Gender (administrative)')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
  });

  it('a deceased patient with a date: badge, date and age at death', async () => {
    const { container } = show(p('deceased-datetime'));
    expect(screen.getByText('Deceased 30 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('Born 2 Jun 1941, died aged 85 years')).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveAccessibleName('Patient: WAGNER, Josef, deceased');
    await expectNoAxeViolations(container);
  });

  it('a deceased patient without a date: no current age is shown', () => {
    const { container } = show(p('deceased-boolean'));
    expect(screen.getByText('Deceased, date not recorded')).toBeInTheDocument();
    expect(screen.getByText('Born 8 Nov 1944, age at death unknown')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('81 years');
  });

  it('an identifier without a system says so', () => {
    show(p('minimal'));
    expect(screen.getByText('ED-TEMP-0042')).toBeInTheDocument();
    expect(screen.getByText('System: not recorded')).toBeInTheDocument();
  });

  it('handles a missing birth date and a name with text only', async () => {
    const { container } = show(p('minimal'));
    expect(screen.getByRole('heading')).toHaveTextContent('Unknown, female, Emergency Department arrival 21 Oct');
    expect(screen.getByText('Date of birth not recorded, age unknown')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows both possible ages for a birth year only, never one guessed', () => {
    show(p('birth-year'));
    expect(screen.getByText('Born 1981 (44 or 45 years, from birth year only)')).toBeInTheDocument();
  });

  it('shows no name and no identifier without breaking', () => {
    show({ resourceType: 'Patient' });
    expect(screen.getByRole('heading')).toHaveTextContent('Name not recorded');
    expect(screen.getByText('No identifier recorded')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });
});

describe('ageOn', () => {
  it('months under 2 years and days under 1 month', () => {
    expect(ageOn({ y: 2025, m: 4, d: 30 }, { y: 2026, m: 10, d: 22 })).toBe('17 months');
    expect(ageOn({ y: 2026, m: 10, d: 1 }, { y: 2026, m: 10, d: 22 })).toBe('21 days');
  });
  it('a birth month narrows the range', () => {
    expect(ageOn({ y: 1981, m: 3 }, { y: 2026, m: 10, d: 22 })).toBe('45 years, from birth month only');
    expect(ageOn({ y: 1981, m: 10 }, { y: 2026, m: 10, d: 22 })).toBe('44 or 45 years, from birth month only');
  });
});
