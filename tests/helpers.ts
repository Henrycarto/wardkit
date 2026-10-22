import axe from 'axe-core';
import type { Bundle, FhirResource, Observation } from 'fhir/r4';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

// Vitest runs from the project root.
export function fixture<T extends FhirResource>(name: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', name), 'utf8')) as T;
}

export function observations(bundleName: string): Observation[] {
  return (fixture<Bundle>(bundleName).entry ?? []).map((e) => e.resource as Observation);
}

/**
 * Runs axe on a rendered component. Colour contrast needs a real browser and is checked by the
 * Playwright job against the docs site.
 */
export async function expectNoAxeViolations(container: Element) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  const messages = result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  expect(messages).toEqual([]);
}

/** A structured copy, so a test can change a fixture without touching the others. */
export const clone = <T>(x: T): T => structuredClone(x);
