import { render, screen } from '@testing-library/react';
import type { AllergyIntolerance } from 'fhir/r4';
import { describe, expect, it } from 'vitest';
import { AllergyBanner, NO_KNOWN_SNOMED } from '@/components/wardkit/allergy-banner';
import { clone, expectNoAxeViolations, fixture } from './helpers';

const a = (name: string) => clone(fixture<AllergyIntolerance>(`allergy-${name}.json`));
const show = (list: AllergyIntolerance[]) => render(<AllergyBanner allergies={list} />);

describe('AllergyBanner: known, none known, not recorded', () => {
  it('"No known allergies" only when a resource records it', async () => {
    const { container } = show([a('nka')]);
    expect(screen.getByRole('heading')).toHaveTextContent('No known allergies');
    await expectNoAxeViolations(container);
  });

  it('an empty list is "No allergy information recorded", which looks different', async () => {
    const first = show([a('nka')]);
    const nka = first.container.firstElementChild!;
    const nkaClass = nka.className;
    const nkaIcon = nka.querySelector('svg')!.getAttribute('class');
    first.unmount();
    const { container } = show([]);
    const empty = container.firstElementChild!;
    expect(screen.getByRole('heading', { name: 'No allergy information recorded' })).toBeInTheDocument();
    expect(screen.queryByText('No known allergies')).not.toBeInTheDocument();
    expect(empty.className).toContain('border-dashed');
    expect(nkaClass).not.toContain('border-dashed');
    expect(empty.querySelector('svg')!.getAttribute('class')).not.toBe(nkaIcon);
    await expectNoAxeViolations(container);
  });

  it('says exactly what was recorded: no known drug allergies is not no known allergies', () => {
    show([a('nkda')]);
    expect(screen.getByRole('heading')).toHaveTextContent('No known drug allergies');
    expect(screen.queryByText('No known allergies')).not.toBeInTheDocument();
  });

  it.each(Object.entries(NO_KNOWN_SNOMED))('SNOMED %s is a "no known" statement, never an allergy', (code, { label }) => {
    const r = a('nka');
    r.code = { coding: [{ system: 'http://snomed.info/sct', code }] };
    show([r]);
    expect(screen.getByRole('heading')).toHaveTextContent(label);
    expect(screen.queryByText(/Allergies and intolerances/)).not.toBeInTheDocument();
  });

  it('reads the IPS absent-unknown codes', () => {
    show([a('ips-no-known')]);
    expect(screen.getByRole('heading')).toHaveTextContent('No known allergies');
  });

  it('treats IPS "no information about allergies" as not recorded, not as none known', () => {
    show([a('ips-no-information')]);
    expect(screen.getByRole('heading', { name: 'No allergy information recorded' })).toBeInTheDocument();
    expect(screen.getByText('The record states that there is no information about allergies.')).toBeInTheDocument();
  });
});

describe('AllergyBanner: what is listed', () => {
  it('shows substance, criticality and reaction', async () => {
    const { container } = show([a('penicillin'), a('codeine-intolerance')]);
    expect(screen.getByRole('heading')).toHaveTextContent('Allergies and intolerances (2)');
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(container).toHaveTextContent('High criticality');
    expect(container).toHaveTextContent('Reaction: Anaphylaxis (severe)');
    expect(container).toHaveTextContent('Codeine (intolerance)');
    await expectNoAxeViolations(container);
  });

  it('hides entered-in-error entries completely', () => {
    const { container } = show([a('penicillin'), a('amoxicillin-entered-in-error')]);
    expect(container).not.toHaveTextContent('Amoxicillin');
    expect(screen.getByRole('heading')).toHaveTextContent('(1)');
  });

  it('an entered-in-error entry alone leaves "not recorded"', () => {
    show([a('amoxicillin-entered-in-error')]);
    expect(screen.getByRole('heading', { name: 'No allergy information recorded' })).toBeInTheDocument();
  });

  it('does not show refuted entries as allergies', () => {
    const { container } = show([a('nkda'), a('amoxicillin-refuted')]);
    expect(container).not.toHaveTextContent('Amoxicillin');
    expect(screen.getByRole('heading')).toHaveTextContent('No known drug allergies');
    expect(container).toHaveTextContent('1 refuted record not listed.');
  });

  it('labels an unconfirmed allergy', () => {
    const { container } = show([a('peanut-unconfirmed')]);
    expect(container).toHaveTextContent('Peanut');
    expect(container).toHaveTextContent('Unconfirmed');
  });

  it('lists resolved allergies apart from active ones', () => {
    show([a('penicillin'), a('egg-resolved')]);
    expect(screen.getByRole('heading')).toHaveTextContent('(1)');
    expect(screen.getByText('Inactive or resolved (1)')).toBeInTheDocument();
  });

  it('flags "no known allergies" recorded next to an active allergy', () => {
    show([a('nka'), a('penicillin')]);
    expect(screen.getByRole('note')).toHaveTextContent('Conflicting records: "No known allergies"');
  });

  it('flags no known drug allergies next to a drug allergy', () => {
    show([a('nkda'), a('penicillin')]);
    expect(screen.getByRole('note')).toHaveTextContent('No known drug allergies');
  });

  it('no known drug allergies next to a food allergy is not a conflict', () => {
    const { container } = show([a('nkda'), a('peanut-unconfirmed')]);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('Also recorded: No known drug allergies.');
  });
});
