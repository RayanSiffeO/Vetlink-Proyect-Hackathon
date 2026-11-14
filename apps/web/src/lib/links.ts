export function specialistProfileHref(specialistId: string, patientId: string): string {
  const query = patientId ? `?patient_id=${patientId}` : '';
  return `/specialists/${specialistId}${query}`;
}

export function specialistListHref(patientId: string): string {
  return patientId ? `/specialists?patient_id=${patientId}` : '/specialists';
}

export function newRequestForSpecialistHref(
  specialistId: string,
  patientId: string,
  slot: string,
): string {
  const params = [`specialist_id=${encodeURIComponent(specialistId)}`];
  if (patientId) params.push(`patient_id=${encodeURIComponent(patientId)}`);
  if (slot) params.push(`slot=${encodeURIComponent(slot)}`);
  return `/requests/new?${params.join('&')}`;
}
