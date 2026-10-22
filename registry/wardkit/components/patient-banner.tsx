import type { HumanName, Identifier, Patient } from 'fhir/r4';
import { CircleSlash } from 'lucide-react';
import { codings, toDate } from '@/lib/wardkit/fhir';
import { cn } from '@/lib/utils';

export interface PatientBannerProps {
  patient: Patient;
  /** The date ages are counted to. Pass it explicitly so server and browser agree. */
  now: Date | string;
  /** IANA time zone that decides which calendar day `now` falls on, e.g. "Europe/Vienna". */
  timeZone?: string;
  className?: string;
}

/** `official`, then `usual`, then the first name that is not marked old. */
export function pickName(names: HumanName[] | undefined): HumanName | undefined {
  if (!names?.length) return undefined;
  return names.find((n) => n.use === 'official') ?? names.find((n) => n.use === 'usual') ?? names.find((n) => n.use !== 'old') ?? names[0];
}

/** "HUBER, Margarete": family name in capitals first, as on most hospital banners. */
export function formatName(n: HumanName | undefined): string {
  if (!n) return 'Name not recorded';
  const given = (n.given ?? []).join(' ');
  if (n.family) return [n.family.toUpperCase(), [given, ...(n.suffix ?? [])].filter(Boolean).join(' ')].filter(Boolean).join(', ') + (n.prefix?.length ? ` (${n.prefix.join(' ')})` : '');
  return n.text ?? (given || 'Name not recorded');
}

/** `official`, then type MR (medical record number), then `usual`, then the first not marked old. */
export function pickIdentifier(ids: Identifier[] | undefined): Identifier | undefined {
  if (!ids?.length) return undefined;
  const mr = ids.find((i) => codings(i.type).some((c) => c.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' && c.code === 'MR'));
  return ids.find((i) => i.use === 'official') ?? mr ?? ids.find((i) => i.use === 'usual') ?? ids.find((i) => i.use !== 'old') ?? ids[0];
}

type YMD = { y: number; m?: number; d?: number };

function parseDate(s: string | undefined): YMD | undefined {
  const m = s?.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return undefined;
  return { y: Number(m[1]), m: m[2] ? Number(m[2]) : undefined, d: m[3] ? Number(m[3]) : undefined };
}

function dayIn(d: Date, timeZone?: string): Required<YMD> {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(p: YMD): string {
  if (p.d && p.m) return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
  if (p.m) return `${MONTHS[p.m - 1]} ${p.y}`;
  return `${p.y}`;
}

/**
 * Age on a given day. Full dates give exact years (months under 2, days under 1 month).
 * A year or year-month only can leave two possible ages; both are shown, never one guessed.
 */
export function ageOn(birth: YMD, on: Required<YMD>): string | undefined {
  if (birth.m === undefined || birth.d === undefined) {
    const full = on.y - birth.y;
    let lo = full - 1;
    let hi = full;
    if (birth.m !== undefined && on.m > birth.m) lo = full;
    if (birth.m !== undefined && on.m < birth.m) hi = full - 1;
    if (hi < 0) return undefined;
    lo = Math.max(0, lo);
    const basis = birth.m === undefined ? 'birth year only' : 'birth month only';
    return lo === hi ? `${hi} years, from ${basis}` : `${lo} or ${hi} years, from ${basis}`;
  }
  const before = on.m < birth.m || (on.m === birth.m && on.d < birth.d);
  const years = on.y - birth.y - (before ? 1 : 0);
  if (years < 0) return undefined;
  if (years >= 2) return `${years} years`;
  const months = (on.y - birth.y) * 12 + (on.m - birth.m) - (on.d < birth.d ? 1 : 0);
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'}`;
  const days = Math.round((Date.UTC(on.y, on.m - 1, on.d) - Date.UTC(birth.y, birth.m - 1, birth.d)) / 86400000);
  return `${days} day${days === 1 ? '' : 's'}`;
}

const GENDER: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other', unknown: 'Unknown' };

export function PatientBanner({ patient: p, now, timeZone, className }: PatientBannerProps) {
  const name = formatName(pickName(p.name));
  const birth = parseDate(p.birthDate);
  const deceased = p.deceasedBoolean === true || p.deceasedDateTime !== undefined;
  const deathDay = p.deceasedDateTime ? dayIn(new Date(p.deceasedDateTime), timeZone) : undefined;
  const today = dayIn(toDate(now), timeZone);
  const age = birth ? ageOn(birth, deathDay ?? today) : undefined;
  const id = pickIdentifier(p.identifier);

  let ageText: string;
  if (!birth) ageText = deceased ? 'Date of birth not recorded' : 'Date of birth not recorded, age unknown';
  else if (deceased && !deathDay) ageText = `Born ${formatDate(birth)}, age at death unknown`;
  else if (deceased) ageText = `Born ${formatDate(birth)}${age ? `, died aged ${age}` : ''}`;
  else ageText = `Born ${formatDate(birth)}${age ? ` (${age})` : ', a date after today'}`;

  return (
    <section
      aria-label={`Patient: ${name}${deceased ? ', deceased' : ''}`}
      className={cn('rounded-lg border bg-card p-4 text-card-foreground', deceased && 'border-2 border-foreground', className)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">{name}</h2>
        {deceased && (
          <span className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-sm font-semibold text-background">
            <CircleSlash aria-hidden="true" className="size-4" />
            Deceased{deathDay ? ` ${formatDate(deathDay)}` : ', date not recorded'}
          </span>
        )}
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Date of birth</dt>
        <dd>{ageText}</dd>
        <dt className="text-muted-foreground">Gender (administrative)</dt>
        <dd>{p.gender ? GENDER[p.gender] : 'Not recorded'}</dd>
        <dt className="text-muted-foreground">Identifier</dt>
        <dd>
          {id?.value ? (
            <>
              <span className="font-mono font-medium">{id.value}</span>
              <span className="block break-all text-muted-foreground">System: {id.system ?? 'not recorded'}</span>
            </>
          ) : (
            'No identifier recorded'
          )}
        </dd>
      </dl>
    </section>
  );
}
