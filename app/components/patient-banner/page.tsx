import type { Metadata } from 'next';
import { PatientBanner } from '@/components/wardkit/patient-banner';
import { bySlug } from '@/site/catalogue';
import { Code, DocHeader, Example, PropsTable, Rules, Section } from '@/site/doc';
import { PATIENT } from '@/site/fixtures';

const doc = bySlug('patient-banner')!;
export const metadata: Metadata = { title: doc.name };
const NOW = '2026-10-22T09:00:00+02:00';
const tz = 'Europe/Vienna';

export default function Page() {
  return (
    <>
      <DocHeader doc={doc} />
      <Section title="Usage">
        <Code>{`import { PatientBanner } from '@/components/wardkit/patient-banner';

<PatientBanner patient={patient} now={new Date()} timeZone="Europe/Vienna" />`}</Code>
      </Section>
      <Section title="Examples">
        <Example title="Three names: the official one is used" note="The record also has a usual name (Grete) and a maiden name (Steiner).">
          <PatientBanner patient={PATIENT.huber} now={NOW} timeZone={tz} />
        </Example>
        <Example title="Deceased, with a date">
          <PatientBanner patient={PATIENT.wagner} now={NOW} timeZone={tz} />
        </Example>
        <Example title="Deceased, no date" note="deceasedBoolean true: no current age is shown.">
          <PatientBanner patient={PATIENT.gruber} now={NOW} timeZone={tz} />
        </Example>
        <Example title="Birth year only">
          <PatientBanner patient={PATIENT.novak} now={NOW} timeZone={tz} />
        </Example>
        <Example title="No birth date, temporary name, identifier without a system">
          <PatientBanner patient={PATIENT.minimal} now={NOW} timeZone={tz} />
        </Example>
      </Section>
      <PropsTable doc={doc} />
      <Rules doc={doc} />
    </>
  );
}
