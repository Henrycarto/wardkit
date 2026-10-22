import type { Metadata } from 'next';
import { LabResult } from '@/components/wardkit/lab-result';
import { bySlug } from '@/site/catalogue';
import { Code, DocHeader, Example, PropsTable, Rules, Section } from '@/site/doc';
import { BP, LAB } from '@/site/fixtures';

const doc = bySlug('lab-result')!;
export const metadata: Metadata = { title: doc.name };
const tz = 'Europe/Vienna';

export default function Page() {
  return (
    <>
      <DocHeader doc={doc} />
      <Section title="Usage">
        <Code>{`import { LabResult } from '@/components/wardkit/lab-result';

<LabResult observation={observation} timeZone="Europe/Vienna" />`}</Code>
      </Section>
      <Section title="Examples">
        <Example title="Interpretation flags" note="One per code. Each flag is text with an icon; colour is never the only signal.">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabResult observation={LAB.kHigh} timeZone={tz} />
            <LabResult observation={LAB.glucose} timeZone={tz} />
            <LabResult observation={LAB.crpHigh} timeZone={tz} />
            <LabResult observation={LAB.sodium} timeZone={tz} />
            <LabResult observation={LAB.nitrite} timeZone={tz} />
            <LabResult observation={LAB.wcc} timeZone={tz} />
          </div>
        </Example>
        <Example title="Status">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabResult observation={LAB.lactate} timeZone={tz} />
            <LabResult observation={LAB.creatinine} timeZone={tz} />
            <LabResult observation={LAB.kCorrected} timeZone={tz} />
            <LabResult observation={LAB.crpEie} timeZone={tz} />
          </div>
        </Example>
        <Example title="Values in components: blood pressure panel" note="LOINC 85354-9 has no top-level value; each component is shown with its own value, flag and range. Right: the diastolic was not measured.">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabResult observation={BP.panel} timeZone={tz} />
            <LabResult observation={BP.diastolicAbsent} timeZone={tz} />
          </div>
        </Example>
        <Example title="No value, and a value below a limit" note="dataAbsentReason shows the reason. A comparator is kept.">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabResult observation={LAB.kHaemolysed} timeZone={tz} />
            <LabResult observation={LAB.crpBelow} timeZone={tz} />
          </div>
        </Example>
      </Section>
      <PropsTable doc={doc} />
      <Rules doc={doc} />
    </>
  );
}
