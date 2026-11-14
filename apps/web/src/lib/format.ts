/**
 * Helpers de presentación: fechas en español, edades, etiquetas y roles.
 * Toda la UI está en español; los identificadores de código, en inglés.
 */
import type { AlertSeverity, Role, User } from '../api/types';

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Parsea `YYYY-MM-DD` / ISO con cuidado (sin desfase de zona). */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // `YYYY-MM-DD` se interpreta como fecha local, no UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0 && !String(value).includes('T');
  if (isMidnight) return formatDate(value);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value)} · ${hh}:${mm}`;
}

export function formatWeekday(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '';
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[date.getDay()];
}

/** Edad en años y meses a partir de `birth_date`. */
export function ageFromBirthDate(birthDate: string | null | undefined): string {
  const date = parseDate(birthDate);
  if (!date) return '—';
  const now = new Date();
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months -= 1;
  if (months < 0) return '—';
  if (months < 24) {
    const m = Math.max(months, 0);
    return m === 1 ? '1 mes' : `${m} meses`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} años` : `${years} años y ${rest} m`;
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) return '—';
  return `${Number(kg).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Consultar';
  return `${Number(value).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;
}

export function relativeTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) {
    if (diffMin === 0) return 'ahora';
    return diffMin > 0 ? `en ${diffMin} min` : `hace ${Math.abs(diffMin)} min`;
  }
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH > 0 ? `en ${diffH} h` : `hace ${Math.abs(diffH)} h`;
  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 30) return diffD > 0 ? `en ${diffD} días` : `hace ${Math.abs(diffD)} días`;
  return formatDate(value);
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export function isSpecialist(user: User | null | undefined): boolean {
  const role = normalizeRole(user?.role);
  return role === 'SPECIALIST';
}

export function normalizeRole(role: Role | null | undefined): 'CLINIC' | 'SPECIALIST' | 'UNKNOWN' {
  const value = String(role ?? '').toUpperCase();
  if (value.startsWith('SPEC') || value === 'VET_SPECIALIST' || value.includes('SPECIALIST')) {
    return 'SPECIALIST';
  }
  if (value.startsWith('CLIN') || value.includes('CLINIC') || value === 'VET') return 'CLINIC';
  return 'UNKNOWN';
}

export function roleLabel(user: User | null | undefined): string {
  const role = normalizeRole(user?.role);
  if (role === 'SPECIALIST') return 'Especialista';
  if (role === 'CLINIC') return 'Clínica';
  return 'Demo';
}

/* ------------------------------------------------------------------ */
/* Severidad de alertas                                                */
/* ------------------------------------------------------------------ */

export interface SeverityStyle {
  label: string;
  badge: string;
  border: string;
  surface: string;
  icon: string;
}

export function severityStyle(severity: AlertSeverity | null | undefined): SeverityStyle {
  switch (String(severity ?? '').toUpperCase()) {
    case 'CRITICAL':
      return {
        label: 'Crítica',
        badge: 'badge-error',
        border: 'border-error/50',
        surface: 'bg-error/5',
        icon: 'text-error',
      };
    case 'HIGH':
      return {
        label: 'Alta',
        badge: 'badge-warning',
        border: 'border-warning/50',
        surface: 'bg-warning/5',
        icon: 'text-warning',
      };
    case 'MEDIUM':
      return {
        label: 'Media',
        badge: 'badge-info',
        border: 'border-info/40',
        surface: 'bg-info/5',
        icon: 'text-info',
      };
    case 'LOW':
      return {
        label: 'Baja',
        badge: 'badge-ghost',
        border: 'border-base-300',
        surface: 'bg-base-200/60',
        icon: 'text-base-content/60',
      };
    default:
      return {
        label: 'Info',
        badge: 'badge-ghost',
        border: 'border-base-300',
        surface: 'bg-base-200/60',
        icon: 'text-base-content/60',
      };
  }
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export function severityRank(severity: AlertSeverity | null | undefined): number {
  return SEVERITY_ORDER[String(severity ?? '').toUpperCase()] ?? 5;
}

/* ------------------------------------------------------------------ */
/* Estados de solicitud                                                */
/* ------------------------------------------------------------------ */

export interface StatusStyle {
  label: string;
  badge: string;
}

export function requestStatusStyle(status: string | null | undefined): StatusStyle {
  switch (String(status ?? '').toUpperCase()) {
    case 'REQUESTED':
      return { label: 'Solicitada', badge: 'badge-warning' };
    case 'ACCEPTED':
      return { label: 'Aceptada', badge: 'badge-success' };
    case 'SCHEDULED':
      return { label: 'Agendada', badge: 'badge-success' };
    case 'DECLINED':
      return { label: 'Rechazada', badge: 'badge-error' };
    case 'CANCELLED':
      return { label: 'Cancelada', badge: 'badge-ghost' };
    case 'COMPLETED':
      return { label: 'Completada', badge: 'badge-secondary' };
    case 'EXPIRED':
      return { label: 'Caducada', badge: 'badge-ghost' };
    default:
      return { label: status ? String(status) : 'Sin estado', badge: 'badge-ghost' };
  }
}

/** Estados en los que la historia completa / briefing ya están desbloqueados. */
export function isUnlockedStatus(status: string | null | undefined): boolean {
  return ['ACCEPTED', 'SCHEDULED', 'COMPLETED'].includes(String(status ?? '').toUpperCase());
}

export function urgencyLabel(urgency: string | null | undefined): string {
  switch (String(urgency ?? '').toUpperCase()) {
    case 'ALTA':
      return 'Urgente';
    case 'MEDIA':
      return 'Media';
    case 'BAJA':
      return 'Baja';
    default:
      return urgency ? String(urgency) : 'Sin especificar';
  }
}

export function urgencyBadge(urgency: string | null | undefined): string {
  switch (String(urgency ?? '').toUpperCase()) {
    case 'ALTA':
      return 'badge-error';
    case 'MEDIA':
      return 'badge-warning';
    case 'BAJA':
      return 'badge-ghost';
    default:
      return 'badge-ghost';
  }
}

export function shareLevelLabel(level: string | null | undefined): string {
  switch (String(level ?? '').toUpperCase()) {
    case 'FULL':
      return 'Ficha completa (FULL)';
    case 'CLINICAL':
    default:
      return 'Solo clínico (CLINICAL)';
  }
}

export function shareLevelHint(level: string | null | undefined): string {
  switch (String(level ?? '').toUpperCase()) {
    case 'FULL':
      return 'El especialista ve la ficha completa y los documentos del paciente.';
    case 'CLINICAL':
    default:
      return 'El especialista ve lo clínico sin datos personales del tutor (RGPD).';
  }
}

/**
 * Extrae el ISO de un slot. La API devuelve strings ISO, pero aceptamos también
 * objetos (`{slot_iso}`, `{iso}`, `{start}`, `{datetime}`) por si el contrato cambia.
 */
export function slotIso(slot: unknown): string {
  if (typeof slot === 'string') return slot.trim();
  if (!slot || typeof slot !== 'object') return '';
  const record = slot as Record<string, unknown>;
  const candidates = ['slot_iso', 'iso', 'start', 'datetime', 'when_iso', 'value'];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

export function slotLabel(slot: unknown): string {
  if (typeof slot === 'string') {
    return slot ? `${formatWeekday(slot)} ${formatDateTime(slot)}` : '';
  }
  if (!slot || typeof slot !== 'object') return '';
  const record = slot as Record<string, unknown>;
  const explicit = record.label ?? record.text;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  const iso = slotIso(record);
  if (!iso) return 'Franja disponible';
  return `${formatWeekday(iso)} ${formatDateTime(iso)}`;
}

export function initials(name: string | null | undefined): string {
  const clean = String(name ?? '').trim();
  if (!clean) return 'VL';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
