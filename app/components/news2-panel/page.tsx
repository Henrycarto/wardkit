import type { Metadata } from 'next';
import type { Observation } from 'fhir/r4';
import { News2Panel } from '@/components/wardkit/news2-panel';
import { bySlug } from '@/site/catalogue';
import { Code, CodeTable, DocHeader, Example, PropsTable, Rules, Section } from '@/site/doc';
import { NEWS2 } from '@/site/fixtures';

const doc = bySlug('news2-panel')!;
export const metadata: Metadata = { title: doc.name };
const tz = 'Europe/Vienna';
const AT_0600 = '2026-10-21T06:00:00+02:00';

const withoutOxygen = NEWS2.normal.filter((o) => !o.id?.endsWith('-o2'));
const rounded: Observation[] = NEWS2.normal.map((o) => (o.id?.endsWith('-rr') ? { ...o, valueQuantity: { ...o.valueQuantity!, value: 11.5 } } : o));

const loinc = (code: string) => `https://loinc.org/${code}/`;
const CODES = [
  { code: '9279-1', meaning: 'Respiratory rate', use: 'Respiration rate. Units /min, {breaths}/min', href: loinc('9279-1') },
  { code: '2708-6', meaning: 'Oxygen saturation in Arterial blood', use: 'SpO₂. Unit %', href: loinc('2708-6') },
  { code: '59408-5', meaning: 'Oxygen saturation in Arterial blood by Pulse oximetry', use: 'SpO₂, accepted as well', href: loinc('59408-5') },
  { code: '85354-9', meaning: 'Blood pressure panel with all children optional', use: 'Systolic read from its 8480-6 component', href: loinc('85354-9') },
  { code: '8480-6', meaning: 'Systolic blood pressure', use: 'Systolic BP, standalone or as a component. Unit mm[Hg]', href: loinc('8480-6') },
  { code: '8867-4', meaning: 'Heart rate', use: 'Pulse. Units /min, {beats}/min', href: loinc('8867-4') },
  { code: '8310-5', meaning: 'Body temperature', use: 'Temperature. Units Cel, [degF] (converted)', href: loinc('8310-5') },
  { code: '67775-7', meaning: 'Level of responsiveness', use: 'Consciousness, AVPU answers (LL1845-8)', href: loinc('67775-7') },
  { code: '80288-4', meaning: 'Level of consciousness', use: 'Consciousness, answers LL3828-2 including Confused', href: loinc('80288-4') },
  { code: '3151-8', meaning: 'Inhaled oxygen flow rate', use: 'Air (0 L/min) or oxygen (more than 0)', href: loinc('3151-8') },
  { code: '3150-0', meaning: 'Inhaled oxygen concentration', use: 'Air (21%) or oxygen (more than 21%)', href: loinc('3150-0') },
  { code: '88658-0', meaning: 'Use of supplemental oxygen', use: 'Oxygen (any answer in LL4908-1)', href: loinc('88658-0') },
];
const ANSWERS = [
  { code: 'LA9340-6', meaning: 'Alert', use: '0 points', href: loinc('LA9340-6') },
  { code: 'LA6560-2', meaning: 'Confused', use: '3 points, labelled "scored as new confusion"', href: loinc('LA6560-2') },
  { code: 'LA17108-4', meaning: 'Verbal', use: '3 points', href: loinc('LA17108-4') },
  { code: 'LA17107-6', meaning: 'Painful', use: '3 points', href: loinc('LA17107-6') },
  { code: 'LA9343-0', meaning: 'Unresponsive', use: '3 points', href: loinc('LA9343-0') },
  { code: 'LA25161-3', meaning: 'Lethargic', use: '3 points', href: loinc('LA25161-3') },
  { code: 'LA25162-1', meaning: 'Obtunded', use: '3 points', href: loinc('LA25162-1') },
  { code: 'LA25163-9', meaning: 'Stuporous', use: '3 points', href: loinc('LA25163-9') },
];

export default function Page() {
  return (
    <>
      <DocHeader doc={doc} />
      <Section title="Usage">
        <Code>{`import { News2Panel } from '@/components/wardkit/news2-panel';

<News2Panel observations={latest} now={new Date()} maxAgeMinutes={60} />`}</Code>
      </Section>
      <Section title="Examples">
        <Example title="Bed 3 at 01:00: score 17, high risk" note="Three parameters score 3 on their own.">
          <News2Panel observations={NEWS2.huber} now="2026-10-21T01:00:00+02:00" maxAgeMinutes={60} timeZone={tz} />
        </Example>
        <Example title="No air or oxygen record: incomplete" note="The same normal set with the oxygen flow Observation removed. Room air is not assumed.">
          <News2Panel observations={withoutOxygen} now={AT_0600} maxAgeMinutes={60} timeZone={tz} />
        </Example>
        <Example title="Stale readings: incomplete" note="The normal set, scored at 07:30 with a 60 minute window.">
          <News2Panel observations={NEWS2.normal} now="2026-10-21T07:30:00+02:00" maxAgeMinutes={60} timeZone={tz} />
        </Example>
        <Example title="A rounded value is shown with what was recorded" note="Respiration rate 11.5 is scored as 12 (0 points); 11 would score 1.">
          <News2Panel observations={rounded} now={AT_0600} maxAgeMinutes={60} timeZone={tz} />
        </Example>
        <Example title="COPD at target on SpO₂ scale 2" note="Scale 2 is turned on by the caller. On scale 1 the same readings score 5.">
          <News2Panel observations={NEWS2.copd} now={AT_0600} maxAgeMinutes={60} spo2Scale={2} timeZone={tz} />
        </Example>
      </Section>
      <PropsTable doc={doc} />
      <Rules doc={doc} />
      <Section title="LOINC codes read">
        <p className="mb-3 text-sm">
          Each code was checked against LOINC 2.82 (all active) through the HL7 terminology server, and the vital sign codes against the{' '}
          <a href="https://hl7.org/fhir/R4/observation-vitalsigns.html" className="text-link underline underline-offset-2">FHIR R4 vital signs profiles</a>.
          Observations with other codes are ignored.
        </p>
        <CodeTable caption="Observation.code (system http://loinc.org)" rows={CODES} />
        <div className="mt-6" />
        <CodeTable caption="Consciousness answers (valueCodeableConcept, system http://loinc.org). Any other answer makes the parameter missing." rows={ANSWERS} />
        <p className="mt-3 text-sm">
          LOINC has no ACVPU answer list. LA6560-2 says Confused, not new confusion; it is scored 3 as new confusion and labelled so on the panel,
          because scoring it 0 could hide a deterioration.
        </p>
      </Section>
    </>
  );
}
