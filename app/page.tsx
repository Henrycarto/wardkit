import Link from 'next/link';
import { News2Panel } from '@/components/wardkit/news2-panel';
import { PatientBanner } from '@/components/wardkit/patient-banner';
import { AllergyBanner } from '@/components/wardkit/allergy-banner';
import { COMPONENTS, REGISTRY } from '@/site/catalogue';
import { Code, Section } from '@/site/doc';
import { ALLERGY, NEWS2, PATIENT } from '@/site/fixtures';

export default function Home() {
  return (
    <>
      <h1 className="text-3xl font-semibold">wardkit</h1>
      <p className="mt-2 text-lg">React components that take FHIR R4 resources as props and render them by the clinical rules they cite.</p>
      <p className="mt-4 rounded-md border-2 border-foreground p-3 text-sm font-medium">
        Not a medical device and not for clinical use. These components are reference implementations for developers.
        Clinical rules are cited so you can check them, not so you can rely on them.
      </p>

      <Section title="What they look like">
        <div className="space-y-3">
          <PatientBanner patient={PATIENT.huber} now="2026-10-21T01:00:00+02:00" timeZone="Europe/Vienna" />
          <AllergyBanner allergies={[ALLERGY.nka]} />
          <News2Panel observations={NEWS2.huber} now="2026-10-21T01:00:00+02:00" maxAgeMinutes={60} timeZone="Europe/Vienna" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Margarete Huber is fictional: Ward 4B bed 3 in the ward monitor, at 01:00 on the night she deteriorates.</p>
      </Section>

      <Section title="Components">
        <ul className="space-y-3">
          {COMPONENTS.map((c) => (
            <li key={c.slug}>
              <Link href={`/components/${c.slug}`} className="font-medium text-link underline underline-offset-2">{c.name}</Link>
              <span className="block text-sm">{c.enforces}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Install">
        <p className="mb-2 text-sm">Each component installs on its own through the shadcn CLI, into a project with Tailwind and the shadcn <code className="font-mono">cn</code> helper.</p>
        <Code>{`npx shadcn@latest add ${REGISTRY}/news2-panel.json`}</Code>
        <p className="mt-2 text-sm">The files land in <code className="font-mono">components/wardkit/</code> and <code className="font-mono">lib/wardkit/</code>. They depend on React, lucide-react and the types in <code className="font-mono">@types/fhir</code>, nothing else.</p>
      </Section>
    </>
  );
}
