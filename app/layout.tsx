import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { COMPONENTS } from '@/site/catalogue';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'wardkit', template: '%s · wardkit' },
  description: 'Clinical UI components for React that take FHIR R4 resources as props.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-background focus:p-2">
          Skip to content
        </a>
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold">wardkit</Link>
            <a href="https://github.com/Henrycarto/wardkit" className="text-sm text-link underline-offset-4 hover:underline">GitHub</a>
          </div>
          <p className="border-t bg-muted px-4 py-2 text-center text-sm">
            Not a medical device and not for clinical use. All patients and data on this site are fictional.
          </p>
        </header>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row">
          <nav aria-label="Components" className="md:w-48 md:shrink-0">
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm md:flex-col">
              <li><Link href="/" className="text-link underline-offset-4 hover:underline">Overview</Link></li>
              {COMPONENTS.map((c) => (
                <li key={c.slug}>
                  <Link href={`/components/${c.slug}`} className="text-link underline-offset-4 hover:underline">{c.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <main id="main" className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
