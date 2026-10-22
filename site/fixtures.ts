/** Fixtures for the docs examples: the same synthetic JSON the tests use. */
import type { AllergyIntolerance, Bundle, Observation, Patient } from 'fhir/r4';
import allergyAmoxicillinEie from '@/fixtures/allergy-amoxicillin-entered-in-error.json';
import allergyAmoxicillinRefuted from '@/fixtures/allergy-amoxicillin-refuted.json';
import allergyCodeine from '@/fixtures/allergy-codeine-intolerance.json';
import allergyEgg from '@/fixtures/allergy-egg-resolved.json';
import allergyNka from '@/fixtures/allergy-nka.json';
import allergyNkda from '@/fixtures/allergy-nkda.json';
import allergyPeanut from '@/fixtures/allergy-peanut-unconfirmed.json';
import allergyPenicillin from '@/fixtures/allergy-penicillin.json';
import labCreatinine from '@/fixtures/lab-creatinine-amended.json';
import labCrpEie from '@/fixtures/lab-crp-entered-in-error.json';
import labCrpHigh from '@/fixtures/lab-crp-high.json';
import labCrpBelow from '@/fixtures/lab-crp-below-limit.json';
import labGlucose from '@/fixtures/lab-glucose-critical-low.json';
import labLactate from '@/fixtures/lab-lactate-preliminary.json';
import labNitrite from '@/fixtures/lab-nitrite-abnormal.json';
import labKCorrected from '@/fixtures/lab-potassium-corrected.json';
import labKHigh from '@/fixtures/lab-potassium-critical-high.json';
import labKHaemolysed from '@/fixtures/lab-potassium-haemolysed.json';
import labSodium from '@/fixtures/lab-sodium-low.json';
import labWcc from '@/fixtures/lab-wcc-normal.json';
import news2Copd from '@/fixtures/news2-copd-scale2.json';
import news2Huber from '@/fixtures/news2-huber-0100.json';
import news2Normal from '@/fixtures/news2-normal.json';
import patientGruber from '@/fixtures/patient-deceased-boolean.json';
import patientWagner from '@/fixtures/patient-deceased-datetime.json';
import patientHuber from '@/fixtures/patient-huber.json';
import patientMinimal from '@/fixtures/patient-minimal.json';
import patientNovak from '@/fixtures/patient-birth-year.json';
import heartRateNight from '@/fixtures/vitals-heart-rate-night.json';

const obs = (b: unknown) => ((b as Bundle).entry ?? []).map((e) => e.resource as Observation);

export const LAB = {
  crpHigh: labCrpHigh as unknown as Observation, crpBelow: labCrpBelow as unknown as Observation, kHigh: labKHigh as unknown as Observation, sodium: labSodium as unknown as Observation,
  glucose: labGlucose as unknown as Observation, wcc: labWcc as unknown as Observation, nitrite: labNitrite as unknown as Observation, lactate: labLactate as unknown as Observation,
  creatinine: labCreatinine as unknown as Observation, kCorrected: labKCorrected as unknown as Observation, crpEie: labCrpEie as unknown as Observation, kHaemolysed: labKHaemolysed as unknown as Observation,
};
export const HEART_RATE_NIGHT = obs(heartRateNight);
export const NEWS2 = { huber: obs(news2Huber), normal: obs(news2Normal), copd: obs(news2Copd) };
export const ALLERGY = {
  penicillin: allergyPenicillin as unknown as AllergyIntolerance, peanut: allergyPeanut as unknown as AllergyIntolerance, codeine: allergyCodeine as unknown as AllergyIntolerance,
  egg: allergyEgg as unknown as AllergyIntolerance, refuted: allergyAmoxicillinRefuted as unknown as AllergyIntolerance, eie: allergyAmoxicillinEie as unknown as AllergyIntolerance,
  nka: allergyNka as unknown as AllergyIntolerance, nkda: allergyNkda as unknown as AllergyIntolerance,
};
export const PATIENT = {
  huber: patientHuber as unknown as Patient, wagner: patientWagner as unknown as Patient, gruber: patientGruber as unknown as Patient, minimal: patientMinimal as unknown as Patient, novak: patientNovak as unknown as Patient,
};
