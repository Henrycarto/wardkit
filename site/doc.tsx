import type { ReactNode } from 'react';
import { REGISTRY, type ComponentDoc, type Source } from './catalogue';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre tabIndex={0} className="overflow-x-auto rounded-md border bg-code p-3 text-sm"><code className="font-mono">{children}</code></pre>
  );
}

export function Example({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-1 text-base font-medium">{title}</h3>
      {note && <p className="mb-2 text-sm text-muted-foreground">{note}</p>}
      <div className="rounded-lg border border-dashed p-3 sm:p-4">{children}</div>
    </div>
  );
}

export function SourceLink({ s }: { s: Source }) {
  return <a href={s.href} className="text-link underline underline-offset-2">{s.label}</a>;
}

export function DocHeader({ doc }: { doc: ComponentDoc }) {
  return (
    <>
      <h1 className="text-3xl font-semibold">{doc.name}</h1>
      <p className="mt-2 text-lg">{doc.summary}</p>
      <p className="mt-2 text-sm"><span className="font-medium">Rule it enforces:</span> {doc.enforces}</p>
      <Section title="Install">
        <Code>{`npx shadcn@latest add ${REGISTRY}/${doc.slug}.json`}</Code>
      </Section>
    </>
  );
}

export function PropsTable({ doc }: { doc: ComponentDoc }) {
  return (
    <Section title="Props">
      <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-4 font-medium">Prop</th>
              <th scope="col" className="py-2 pr-4 font-medium">Type</th>
              <th scope="col" className="py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {doc.props.map((p) => (
              <tr key={p.name} className="border-b align-top">
                <td className="py-2 pr-4 font-mono">{p.name}{p.required ? '' : '?'}</td>
                <td className="py-2 pr-4 font-mono">{p.type}</td>
                <td className="py-2">{p.description}{p.required ? ' Required.' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function Rules({ doc }: { doc: ComponentDoc }) {
  return (
    <Section title="Clinical rules and sources">
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        {doc.rules.map((r, i) => (
          <li key={i}>
            {r.rule}
            {r.sources.length > 0 && (
              <span className="block text-muted-foreground">
                Source: {r.sources.map((s, j) => <span key={s.href}>{j > 0 ? '; ' : ''}<SourceLink s={s} /></span>)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function CodeTable({ caption, rows }: { caption: string; rows: Array<{ code: string; meaning: string; use: string; href: string }> }) {
  return (
    <div tabIndex={0} role="region" aria-label="Scrollable table" className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left text-muted-foreground">{caption}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-4 font-medium">Code</th>
            <th scope="col" className="py-2 pr-4 font-medium">Meaning</th>
            <th scope="col" className="py-2 font-medium">Used for</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b align-top">
              <td className="py-2 pr-4 font-mono"><a href={r.href} className="text-link underline underline-offset-2">{r.code}</a></td>
              <td className="py-2 pr-4">{r.meaning}</td>
              <td className="py-2">{r.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
