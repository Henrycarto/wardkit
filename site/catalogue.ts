/** What the docs site says about each component: one place, so the overview and the pages agree. */

export const REGISTRY = 'https://raw.githubusercontent.com/Henrycarto/wardkit/main/public/r';

export interface Source { label: string; href: string }
export interface Rule { rule: string; sources: Source[] }
export interface Prop { name: string; type: string; required?: boolean; description: string }

export interface ComponentDoc {
  slug: string;
  name: string;
  summary: string;
  /** The one rule the README lists for the component. */
  enforces: string;
  props: Prop[];
  rules: Rule[];
}

const R4 = (page: string, label: string): Source => ({ label: `FHIR R4: ${label}`, href: `https://hl7.org/fhir/R4/${page}` });
export const RCP: Source = {
  label: 'Royal College of Physicians, National Early Warning Score (NEWS) 2, 2017',
  href: 'https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/',
};

const common: Prop[] = [{ name: 'className', type: 'string', description: 'Extra classes for the outer element.' }];
const tz: Prop = { name: 'timeZone', type: 'string', description: 'IANA time zone for displayed times, e.g. "Europe/Vienna". Defaults to the runtime zone; pass it when rendering on a server.' };

export const COMPONENTS: ComponentDoc[] = [
  {
    slug: 'lab-result',
    name: 'LabResult',
    summary: 'One lab result from an Observation: value and unit, reference range, interpretation flag and status.',
    enforces: 'An entered-in-error result is never shown as valid, and a missing value shows its reason, never a blank or a zero.',
    props: [
      { name: 'observation', type: 'Observation', required: true, description: 'A FHIR R4 Observation with one result.' },
      tz,
      ...common,
    ],
    rules: [
      { rule: 'The flag comes only from Observation.interpretation (H, L, HH, LL, A, N). It is never worked out from the reference range. Each flag has text and an icon, not only a colour.', sources: [{ label: 'HL7 v3 ObservationInterpretation', href: 'https://terminology.hl7.org/CodeSystem-v3-ObservationInterpretation.html' }] },
      { rule: 'preliminary is marked as preliminary; amended and corrected are marked as changed after the first report.', sources: [R4('valueset-observation-status.html', 'ObservationStatus')] },
      { rule: 'entered-in-error shows that the record is not valid and shows no value and no flag. registered shows as pending, cancelled as cancelled.', sources: [R4('valueset-observation-status.html', 'ObservationStatus')] },
      { rule: 'When dataAbsentReason is set, the reason is shown in place of a value.', sources: [R4('valueset-data-absent-reason.html', 'DataAbsentReason'), R4('observation.html#invs', 'Observation invariant obs-6')] },
      { rule: 'A Quantity comparator is kept: "<5 mg/L" is never shown as "5 mg/L".', sources: [R4('datatypes.html#Quantity', 'Quantity.comparator')] },
      { rule: 'Every referenceRange is shown with its type, appliesTo and age when present.', sources: [R4('observation-definitions.html#Observation.referenceRange', 'Observation.referenceRange')] },
    ],
  },
  {
    slug: 'vitals-trend',
    name: 'VitalsTrend',
    summary: 'An SVG trend of one vital sign from a list of Observations, with gaps and a reference band.',
    enforces: 'A missing reading breaks the line into a visible gap; nothing is interpolated across it.',
    props: [
      { name: 'observations', type: 'Observation[]', required: true, description: 'Observations of one vital sign, in any order.' },
      { name: 'componentCode', type: 'string', description: 'Plot this LOINC component instead of valueQuantity, e.g. "8480-6" for systolic from a 85354-9 panel.' },
      { name: 'maxGapMinutes', type: 'number', description: 'Break the line when two readings are further apart than this.' },
      { name: 'title', type: 'string', description: 'Chart title. Defaults to the Observation code text.' },
      tz,
      ...common,
    ],
    rules: [
      { rule: 'A dataAbsentReason, a reading without a value, an entered-in-error reading and a cancelled one each break the line and are marked on the time axis.', sources: [R4('valueset-data-absent-reason.html', 'DataAbsentReason'), R4('valueset-observation-status.html', 'ObservationStatus')] },
      { rule: 'Every point on the line is a recorded value. Values are never interpolated, smoothed or clamped; the axis covers all readings.', sources: [] },
      { rule: 'A value with a comparator ("<", ">") is not exact and is shown as a gap, not plotted.', sources: [R4('datatypes.html#Quantity', 'Quantity.comparator')] },
      { rule: 'Readings with different codes or different units are not plotted together and nothing is converted.', sources: [R4('observation-vitalsigns.html', 'Vital signs profiles')] },
      { rule: 'The shaded band is the referenceRange of the most recent reading that has one.', sources: [R4('observation-definitions.html#Observation.referenceRange', 'Observation.referenceRange')] },
      { rule: 'A table of every reading and gap sits under the chart for screen readers and for checking.', sources: [] },
    ],
  },
  {
    slug: 'news2-panel',
    name: 'News2Panel',
    summary: 'NEWS2 from the latest Observations, with the clinical risk band and the response it calls for.',
    enforces: 'NEWS2 is scored only from a complete, current set; otherwise it says which parameter is missing. Never from a guessed value.',
    props: [
      { name: 'observations', type: 'Observation[]', required: true, description: 'Recent Observations for one patient. Only the codes listed below are read.' },
      { name: 'now', type: 'Date | string', required: true, description: 'The time the score is for.' },
      { name: 'maxAgeMinutes', type: 'number', required: true, description: 'How old a reading may be and still count.' },
      { name: 'spo2Scale', type: '1 | 2', description: 'SpO2 scale 2 only when a clinician has prescribed it. Default 1.' },
      tz,
      ...common,
    ],
    rules: [
      { rule: 'Points per parameter and the aggregate follow the RCP NEWS2 chart (2017): 0 is low, 1 to 4 low, 5 to 6 medium, 7 or more high clinical risk.', sources: [RCP] },
      { rule: 'A score of 3 in any single parameter sets the risk to at least low-medium (urgent ward-based response). The panel names the parameter.', sources: [RCP] },
      { rule: 'SpO2 scale 2 is used only when the caller turns it on. On scale 2, saturations above 92% score only when on oxygen.', sources: [RCP] },
      { rule: 'Each parameter uses its most recent reading. If that reading has a dataAbsentReason, is older than maxAgeMinutes, is timed after now, has a comparator or an unsupported unit, the parameter is missing and there is no total. An older value never stands in for a newer failed one.', sources: [RCP, R4('valueset-data-absent-reason.html', 'DataAbsentReason')] },
      { rule: 'Any supplemental oxygen scores 2 (RCP). wardkit convention: air or oxygen must be recorded; there is no default to room air, so without a record the score is incomplete.', sources: [RCP] },
      { rule: 'wardkit convention, not an RCP rule: the chart bands are whole numbers (one decimal for temperature), so respiration rate, SpO2, systolic pressure and pulse are rounded half up to whole numbers and temperature to one decimal. When a value was rounded, the panel shows the recorded value next to the one used, for example "12 /min (recorded 11.5)".', sources: [] },
    ],
  },
  {
    slug: 'allergy-banner',
    name: 'AllergyBanner',
    summary: 'Allergies and intolerances with substance, criticality and reaction.',
    enforces: '"No known allergies" only when a resource records it; an empty list shows "No allergy information recorded", which looks different.',
    props: [
      { name: 'allergies', type: 'AllergyIntolerance[]', required: true, description: 'Every AllergyIntolerance for the patient, including entered-in-error and refuted ones.' },
      ...common,
    ],
    rules: [
      { rule: 'verificationStatus entered-in-error: hidden. refuted: not shown as an allergy (a count is noted).', sources: [R4('valueset-allergyintolerance-verification.html', 'AllergyIntoleranceVerificationStatus')] },
      { rule: 'clinicalStatus inactive or resolved: listed apart from active allergies.', sources: [R4('valueset-allergyintolerance-clinical.html', 'AllergyIntoleranceClinicalStatus')] },
      { rule: 'A "no known" statement is shown only when a resource carries one of the codes listed below, and exactly as recorded: "No known drug allergies" is never shown as "No known allergies".', sources: [{ label: 'IPS 2.0.1: Allergies and Intolerances value set', href: 'https://hl7.org/fhir/uv/ips/STU2/ValueSet-allergies-intolerances-uv-ips.html' }, { label: 'IPS 1.1.0: Absent or Unknown Allergies', href: 'https://hl7.org/fhir/uv/ips/STU1.1/ValueSet-absent-or-unknown-allergies-uv-ips.html' }] },
      { rule: 'An empty list, or the IPS code "no-allergy-info", shows "No allergy information recorded" with a dashed border and a question icon: unknown is not the same as none.', sources: [{ label: 'IPS 1.1.0: ConceptMap absence to SNOMED (no-allergy-info is unmatched)', href: 'https://hl7.org/fhir/uv/ips/STU1.1/ConceptMap-absence-to-snomed-uv-ips.html' }] },
      { rule: 'A "no known" statement next to an active allergy in the same category is flagged as conflicting. "No known allergies" conflicts with any active allergy.', sources: [R4('allergyintolerance.html', 'AllergyIntolerance.category')] },
      { rule: 'Unconfirmed entries are shown and labelled unconfirmed. Missing criticality says "Criticality not recorded".', sources: [R4('allergyintolerance.html', 'AllergyIntolerance')] },
    ],
  },
  {
    slug: 'patient-banner',
    name: 'PatientBanner',
    summary: 'Name, date of birth with age, administrative gender and the main identifier with its system.',
    enforces: 'Uses the official name, shows the identifier system, and handles a missing birth date and a deceased patient without breaking.',
    props: [
      { name: 'patient', type: 'Patient', required: true, description: 'A FHIR R4 Patient.' },
      { name: 'now', type: 'Date | string', required: true, description: 'The day ages are counted to. Required so server and browser agree.' },
      { name: 'timeZone', type: 'string', description: 'IANA time zone that decides which calendar day now falls on.' },
      ...common,
    ],
    rules: [
      { rule: 'Name: use official, then usual, then the first name not marked old.', sources: [R4('valueset-name-use.html', 'NameUse')] },
      { rule: 'Identifier: use official, then type MR, then usual, then the first not marked old. The system URI is always shown, or "not recorded".', sources: [R4('datatypes.html#Identifier', 'Identifier'), { label: 'HL7 v2 table 0203 (MR)', href: 'https://terminology.hl7.org/CodeSystem-v2-0203.html' }] },
      { rule: 'Age from birthDate on the given day. A year or year-month only shows both possible ages, never one guessed. A missing birth date says so.', sources: [R4('patient-definitions.html#Patient.birthDate', 'Patient.birthDate')] },
      { rule: 'deceasedBoolean or deceasedDateTime shows a "Deceased" badge. With a date, age at death is shown; without one, no age is shown.', sources: [R4('patient-definitions.html#Patient.deceased_x_', 'Patient.deceased[x]')] },
      { rule: 'Gender is labelled administrative gender, the FHIR meaning of Patient.gender.', sources: [R4('valueset-administrative-gender.html', 'AdministrativeGender')] },
    ],
  },
];

export const bySlug = (slug: string) => COMPONENTS.find((c) => c.slug === slug);
