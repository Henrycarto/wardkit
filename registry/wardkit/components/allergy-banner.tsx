import type { AllergyIntolerance } from 'fhir/r4';
import { AlertTriangle, CircleCheck, CircleHelp } from 'lucide-react';
import { SNOMED, codings, conceptText } from '@/lib/wardkit/fhir';
import { cn } from '@/lib/utils';

export interface AllergyBannerProps {
  /** Every AllergyIntolerance for the patient, including entered-in-error and refuted ones. */
  allergies: AllergyIntolerance[];
  className?: string;
}

type Scope = 'all' | 'medication' | 'food' | 'environment' | 'other';

/**
 * Codes that record the absence of allergies. SNOMED CT: 716186003 and every concept under it
 * (the IPS 2.0.1 allergy value set includes `is-a 716186003`). IPS 1.1.0: its own absent-unknown
 * code system. "no-allergy-info" means nothing is known, which is not the same as "no known
 * allergies", so it is handled with the empty list.
 */
export const NO_KNOWN_SNOMED: Record<string, { label: string; scope: Scope }> = {
  '716186003': { label: 'No known allergies', scope: 'all' },
  '409137002': { label: 'No known drug allergies', scope: 'medication' },
  '429625007': { label: 'No known food allergies', scope: 'food' },
  '428607008': { label: 'No known environmental allergies', scope: 'environment' },
  '428197003': { label: 'No known insect allergies', scope: 'other' },
  '716220001': { label: 'No known animal allergies', scope: 'other' },
  '1003774007': { label: 'No known latex allergy', scope: 'other' },
};

export const IPS_ABSENT_UNKNOWN = 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips';
export const NO_KNOWN_IPS: Record<string, { label: string; scope: Scope }> = {
  'no-known-allergies': { label: 'No known allergies', scope: 'all' },
  'no-known-medication-allergies': { label: 'No known medication allergies', scope: 'medication' },
  'no-known-food-allergies': { label: 'No known food allergies', scope: 'food' },
  'no-known-environmental-allergies': { label: 'No known environmental allergies', scope: 'environment' },
};

const status = (cc: AllergyIntolerance['clinicalStatus']) => codings(cc)[0]?.code;

export interface AllergySummary {
  /** Active allergies and intolerances. */
  active: AllergyIntolerance[];
  /** Inactive or resolved ones, shown apart. */
  inactive: AllergyIntolerance[];
  /** Active "no known ..." statements. */
  noKnown: Array<{ label: string; scope: Scope }>;
  /** An explicit IPS "no information about allergies" record. */
  noInformation: boolean;
  refuted: number;
  /** "No known ..." statements contradicted by an active allergy in the same category. */
  conflicts: string[];
}

function noKnownOf(a: AllergyIntolerance): { label: string; scope: Scope } | undefined {
  for (const c of codings(a.code)) {
    if (c.system === SNOMED && c.code && NO_KNOWN_SNOMED[c.code]) return NO_KNOWN_SNOMED[c.code];
    if (c.system === IPS_ABSENT_UNKNOWN && c.code && NO_KNOWN_IPS[c.code]) return NO_KNOWN_IPS[c.code];
  }
  return undefined;
}

const isNoInformation = (a: AllergyIntolerance) => codings(a.code).some((c) => c.system === IPS_ABSENT_UNKNOWN && c.code === 'no-allergy-info');

export function summariseAllergies(list: AllergyIntolerance[]): AllergySummary {
  const out: AllergySummary = { active: [], inactive: [], noKnown: [], noInformation: false, refuted: 0, conflicts: [] };
  for (const a of list) {
    const verification = codings(a.verificationStatus)[0]?.code;
    if (verification === 'entered-in-error') continue;
    if (verification === 'refuted') { out.refuted += 1; continue; }
    const clinical = status(a.clinicalStatus);
    const inactive = clinical === 'inactive' || clinical === 'resolved';
    const nk = noKnownOf(a);
    if (nk) { if (!inactive) out.noKnown.push(nk); continue; }
    if (isNoInformation(a)) { if (!inactive) out.noInformation = true; continue; }
    (inactive ? out.inactive : out.active).push(a);
  }
  for (const nk of out.noKnown) {
    const clash = out.active.some((a) => nk.scope === 'all' || (nk.scope !== 'other' && (a.category ?? []).includes(nk.scope as 'food' | 'medication' | 'environment')));
    if (clash) out.conflicts.push(nk.label);
  }
  return out;
}

const CRITICALITY: Record<string, string> = { high: 'High criticality', low: 'Low criticality', 'unable-to-assess': 'Criticality unable to assess' };

function AllergyItem({ a }: { a: AllergyIntolerance }) {
  const substance = conceptText(a.code) ?? 'Substance not recorded';
  const unconfirmed = codings(a.verificationStatus)[0]?.code === 'unconfirmed';
  const reactions = (a.reaction ?? []).map((r) => {
    const m = (r.manifestation ?? []).map(conceptText).filter(Boolean).join(', ') || 'reaction not described';
    return r.severity ? `${m} (${r.severity})` : m;
  });
  return (
    <li className="py-1">
      <span className="font-semibold">{substance}</span>
      {a.type === 'intolerance' && <span> (intolerance)</span>}
      <span>. {a.criticality ? CRITICALITY[a.criticality] : 'Criticality not recorded'}</span>
      {a.criticality === 'high' && <AlertTriangle aria-hidden="true" className="ml-1 inline size-4 align-text-bottom" />}
      {unconfirmed && <span className="font-medium">. Unconfirmed</span>}
      <span>. {reactions.length ? `Reaction: ${reactions.join('; ')}` : 'No reaction recorded'}.</span>
    </li>
  );
}

export function AllergyBanner({ allergies, className }: AllergyBannerProps) {
  const s = summariseAllergies(allergies);
  const footnote = s.refuted > 0 ? `${s.refuted} refuted record${s.refuted === 1 ? '' : 's'} not listed.` : null;

  if (s.active.length > 0) {
    return (
      <section aria-label="Allergies" className={cn('rounded-lg border-2 border-red-700 bg-red-50 p-4 text-red-950 dark:border-red-400 dark:bg-red-950 dark:text-red-50', className)}>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          Allergies and intolerances ({s.active.length})
        </h3>
        {s.conflicts.length > 0 && (
          <p className="mt-2 rounded-md border border-current p-2 text-sm font-medium" role="note">
            Conflicting records: &quot;{s.conflicts.join('", "')}&quot; is also recorded. Check the record.
          </p>
        )}
        <ul className="mt-2 text-sm">{s.active.map((a, i) => <AllergyItem key={a.id ?? i} a={a} />)}</ul>
        {s.noKnown.length > 0 && s.conflicts.length < s.noKnown.length && (
          <p className="mt-1 text-sm">Also recorded: {s.noKnown.filter((n) => !s.conflicts.includes(n.label)).map((n) => n.label).join(', ')}.</p>
        )}
        <Inactive list={s.inactive} />
        {footnote && <p className="mt-2 text-xs">{footnote}</p>}
      </section>
    );
  }

  if (s.noKnown.length > 0) {
    return (
      <section aria-label="Allergies" className={cn('rounded-lg border-2 border-emerald-700 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50', className)}>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
          {s.noKnown.map((n) => n.label).join('. ')}
        </h3>
        <p className="mt-1 text-sm">Recorded explicitly in the patient&apos;s record.</p>
        <Inactive list={s.inactive} />
        {footnote && <p className="mt-2 text-xs">{footnote}</p>}
      </section>
    );
  }

  return (
    <section aria-label="Allergies" className={cn('rounded-lg border-2 border-dashed border-foreground/60 bg-card p-4 text-card-foreground', className)}>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <CircleHelp aria-hidden="true" className="size-5 shrink-0" />
        No allergy information recorded
      </h3>
      <p className="mt-1 text-sm">
        {s.noInformation ? 'The record states that there is no information about allergies.' : 'Nothing is recorded either way. Unknown is not the same as no known allergies.'}
      </p>
      <Inactive list={s.inactive} />
      {footnote && <p className="mt-2 text-xs">{footnote}</p>}
    </section>
  );
}

function Inactive({ list }: { list: AllergyIntolerance[] }) {
  if (list.length === 0) return null;
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer">Inactive or resolved ({list.length})</summary>
      <ul>{list.map((a, i) => <AllergyItem key={a.id ?? i} a={a} />)}</ul>
    </details>
  );
}
