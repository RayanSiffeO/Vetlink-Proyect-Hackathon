import type { AlertItem, CanonicalPatient, Encounter, PatientSummary } from '../api/types';
import { ageFromBirthDate, formatWeight } from './format';
import { lookupValue } from './lookup';

export type AnyPatient = CanonicalPatient | PatientSummary;

export interface PatientFacts {
  name: string;
  initial: string;
  species: string;
  breed: string;
  sex: string | null;
  microchip: string;
  owner: string;
  status: string | null;
  bcs: string | null;
  weight: string;
  age: string;
  birthDate: string | null | undefined;
}

const SEX_LABELS: Record<string, string> = {
  MALE: 'Macho',
  FEMALE: 'Hembra',
  M: 'Macho',
  F: 'Hembra',
};

export function sexLabel(sex: string): string {
  return lookupValue(SEX_LABELS, sex.toUpperCase(), sex);
}

export function patientValue(patient: AnyPatient, keys: string[]): string | null {
  for (const key of keys) {
    const value = (patient as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

export function patientInitial(patient: AnyPatient): string {
  const name = (patient as { name?: string }).name;
  return String(name ?? 'VL').slice(0, 1).toUpperCase();
}

export function patientFacts(patient: AnyPatient): PatientFacts {
  return {
    name: patientValue(patient, ['name']) ?? 'Paciente',
    initial: patientInitial(patient),
    species: patientValue(patient, ['species', 'species_label']) ?? 'Especie sin definir',
    breed: patientValue(patient, ['breed', 'breed_label']) ?? 'Raza sin definir',
    sex: patientValue(patient, ['sex']),
    microchip: patientValue(patient, ['microchip']) ?? '—',
    owner: patientValue(patient, ['owner_display']) ?? 'Tutor no registrado',
    status: patientValue(patient, ['status']),
    bcs: patientValue(patient, ['bcs']),
    weight: formatWeight((patient as { weight_current_kg?: number | null }).weight_current_kg),
    age: ageFromBirthDate((patient as { birth_date?: string | null }).birth_date),
    birthDate: (patient as { birth_date?: string | null }).birth_date,
  };
}

export function sortEncounters(encounters: Encounter[] | undefined): Encounter[] {
  return [...(encounters ?? [])].sort((a, b) =>
    String(b.date ?? '').localeCompare(String(a.date ?? '')),
  );
}

export function countCriticalAlerts(alerts: AlertItem[]): number {
  return alerts.filter((alert) =>
    ['CRITICAL', 'HIGH'].includes(String(alert.severity).toUpperCase()),
  ).length;
}

export function countPatientAlerts(patients: PatientSummary[]): number {
  return patients.reduce((sum, patient) => sum + Number(patient.alerts_count ?? 0), 0);
}

export function identityConfidencePercent(patient: PatientSummary): number | null {
  const raw = patient.identity_confidence;
  if (raw === null || raw === undefined) return null;
  return Math.round(Number(raw) * 100);
}
