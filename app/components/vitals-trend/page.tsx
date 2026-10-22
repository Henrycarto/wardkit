import type { Metadata } from 'next';
import { VitalsTrend } from '@/components/wardkit/vitals-trend';
import { bySlug } from '@/site/catalogue';
import { Code, DocHeader, Example, PropsTable, Rules, Section } from '@/site/doc';
import { HEART_RATE_NIGHT } from '@/site/fixtures';

const doc = bySlug('vitals-trend')!;
export const metadata: Metadata = { title: doc.name };

export default function Page() {
  return (
    <>
      <DocHeader doc={doc} />
      <Section title="Usage">
        <Code>{`import { VitalsTrend } from '@/components/wardkit/vitals-trend';

<VitalsTrend observations={heartRate} maxGapMinutes={120} timeZone="Europe/Vienna" />`}</Code>
      </Section>
      <Section title="Examples">
        <Example
          title="Heart rate overnight, maxGapMinutes 120"
          note="A failed reading at 22:00 (probe off), a reading entered in error at 02:00, and nothing from 03:00 to 06:00. The line breaks at each; the band is the reference range."
        >
          <VitalsTrend observations={HEART_RATE_NIGHT} maxGapMinutes={120} timeZone="Europe/Vienna" />
        </Example>
        <Example title="The same readings without maxGapMinutes" note="Only recorded gaps break the line. 03:00 to 06:00 is joined because nothing says a reading was missed.">
          <VitalsTrend observations={HEART_RATE_NIGHT} timeZone="Europe/Vienna" />
        </Example>
      </Section>
      <PropsTable doc={doc} />
      <Rules doc={doc} />
    </>
  );
}
