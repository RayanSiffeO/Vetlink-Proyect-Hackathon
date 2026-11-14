import type { Appointment } from '../api/types';

export function sortAppointments(appointments: Appointment[] | undefined): Appointment[] {
  return [...(appointments ?? [])].sort((a, b) =>
    String(a.when_iso ?? '').localeCompare(String(b.when_iso ?? '')),
  );
}

export function findRequestAppointment(
  appointments: Appointment[] | undefined,
  requestId: string,
): Appointment | null {
  return (appointments ?? []).find((item) => item.request_id === requestId) ?? null;
}
