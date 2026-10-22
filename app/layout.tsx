import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { COMPONENTS } from '@/site/catalogue';
import './globals.css';

const DESCRIPTION = 'Clinical UI components for React that take FHIR R4 resources as props.';
// Vercel sets VERCEL_PROJECT_PRODUCTION_URL at build time; Open Graph image URLs must be absolute.
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
const PREVIEW = { url: '/social-preview.png', width: 1280, height: 640, alt: 'wardkit' };

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'wardkit', template: '%s · wardkit' },
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  openGraph: { title: 'wardkit', description: DESCRIPTION, type: 'website', images: [PREVIEW] },
  twitter: { card: 'summary_large_image', title: 'wardkit', description: DESCRIPTION, images: [PREVIEW.url] },
};

/**
 * The wardkit icon (public/icon.svg), drawn in the current text colour. Shown at 32 px: on its
 * 24-unit grid the squares only land on whole pixels at multiples of 32, so smaller sizes blur.
 */
function WardkitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-8 shrink-0 text-link">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M15.3 18.2h1l.9-2 1.3 3 .8-1h.5" strokeWidth="1.5" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-background focus:p-2">
          Skip to content
        </a>
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold">
              <WardkitIcon />
              wardkit
            </Link>
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
