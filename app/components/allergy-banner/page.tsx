import type { Metadata } from 'next';
import { AllergyBanner, NO_KNOWN_IPS, NO_KNOWN_SNOMED } from '@/components/wardkit/allergy-banner';
import { bySlug } from '@/site/catalogue';
import { Code, CodeTable, DocHeader, Example, PropsTable, Rules, Section } from '@/site/doc';
import { ALLERGY } from '@/site/fixtures';

const doc = bySlug('allergy-banner')!;
export const metadata: Metadata = { title: doc.name };

const SNOMED_ROWS = Object.entries(NO_KNOWN_SNOMED).map(([code, v]) => ({
  code, meaning: v.label, use: code === '716186003' ? 'Parent concept; conflicts with any active allergy' : `Under 716186003${v.scope === 'other' ? '' : `; conflicts with ${v.scope} allergies`}`,
  href: `https://browser.ihtsdotools.org/?perspective=full&conceptId1=${code}`,
}));
const IPS_ROWS = [
  ...Object.entries(NO_KNOWN_IPS).map(([code, v]) => ({ code, meaning: v.label, use: 'Same as the SNOMED code it maps to', href: 'https://hl7.org/fhir/uv/ips/STU1.1/ValueSet-absent-or-unknown-allergies-uv-ips.html' })),
  { code: 'no-allergy-info', meaning: 'No information about allergies', use: 'Shown as "No allergy information recorded"', href: 'https://hl7.org/fhir/uv/ips/STU1.1/ValueSet-absent-or-unknown-allergies-uv-ips.html' },
];

export default function Page() {
  return (
    <>
      <DocHeader doc={doc} />
      <Section title="Usage">
        <Code>{`import { AllergyBanner } from '@/components/wardkit/allergy-banner';

<AllergyBanner allergies={allergyIntolerances} />`}</Code>
      </Section>
      <Section title="Examples">
        <Example title="No known allergies, recorded" note="An AllergyIntolerance with SNOMED 716186003.">
          <AllergyBanner allergies={[ALLERGY.nka]} />
        </Example>
        <Example title="Nothing recorded" note="An empty list. Different text, icon and border: unknown is not none.">
          <AllergyBanner allergies={[]} />
        </Example>
        <Example
          title="Allergies, with hidden and inactive entries"
          note="Penicillin (high criticality), unconfirmed peanut, codeine intolerance, resolved egg, a refuted amoxicillin and an amoxicillin entered in error. The last two are not listed as allergies."
        >
          <AllergyBanner allergies={[ALLERGY.penicillin, ALLERGY.peanut, ALLERGY.codeine, ALLERGY.egg, ALLERGY.refuted, ALLERGY.eie]} />
        </Example>
        <Example title="No known drug allergies, next to a drug allergy" note="Flagged as conflicting.">
          <AllergyBanner allergies={[ALLERGY.nkda, ALLERGY.penicillin]} />
        </Example>
      </Section>
      <PropsTable doc={doc} />
      <Rules doc={doc} />
      <Section title="No-known-allergy codes">
        <p className="mb-3 text-sm">
          IPS 2.0.1 includes SNOMED CT 716186003 and every concept under it in its{' '}
          <a href="https://hl7.org/fhir/uv/ips/STU2/ValueSet-allergies-intolerances-uv-ips.html" className="text-link underline underline-offset-2">allergies and intolerances value set</a>.
          That is seven concepts in SNOMED CT International 2025-02-01, all active, checked through the HL7 terminology server. Recognising only four would
          show &quot;No known latex allergy&quot; as an allergy to latex.
        </p>
        <CodeTable caption="AllergyIntolerance.code, system http://snomed.info/sct" rows={SNOMED_ROWS} />
        <div className="mt-6" />
        <CodeTable caption="AllergyIntolerance.code, system http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips (IPS 1.1.0)" rows={IPS_ROWS} />
      </Section>
    </>
  );
}
