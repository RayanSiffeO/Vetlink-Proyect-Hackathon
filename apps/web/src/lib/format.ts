import type { AlertSeverity, Role, User } from '../api/types';
import { lookupValue } from './lookup';

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

const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const DASH = '—';

export interface SeverityStyle {
  label: string;
  badge: string;
  border: string;
  surface: string;
  icon: string;
}

export interface StatusStyle {
  label: string;
  badge: string;
}

const SEVERITY_STYLES: Record<string, SeverityStyle> = {
  CRITICAL: {
    label: 'Crítica',
    badge: 'badge-error',
    border: 'border-error/50',
    surface: 'bg-error/5',
    icon: 'text-error',
  },
  HIGH: {
    label: 'Alta',
    badge: 'badge-warning',
    border: 'border-warning/50',
    surface: 'bg-warning/5',
    icon: 'text-warning',
  },
  MEDIUM: {
    label: 'Media',
    badge: 'badge-info',
    border: 'border-info/40',
    surface: 'bg-info/5',
    icon: 'text-info',
  },
  LOW: {
    label: 'Baja',
    badge: 'badge-ghost',
    border: 'border-base-300',
    surface: 'bg-base-200/60',
    icon: 'text-base-content/60',
  },
};

const SEVERITY_FALLBACK: SeverityStyle = {
  label: 'Info',
  badge: 'badge-ghost',
  border: 'border-base-300',
  surface: 'bg-base-200/60',
  icon: 'text-base-content/60',
};

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

const REQUEST_STATUS_STYLES: Record<string, StatusStyle> = {
  REQUESTED: { label: 'Solicitada', badge: 'badge-warning' },
  ACCEPTED: { label: 'Aceptada', badge: 'badge-success' },
  SCHEDULED: { label: 'Agendada', badge: 'badge-success' },
  DECLINED: { label: 'Rechazada', badge: 'badge-error' },
  CANCELLED: { label: 'Cancelada', badge: 'badge-ghost' },
  COMPLETED: { label: 'Completada', badge: 'badge-secondary' },
  EXPIRED: { label: 'Caducada', badge: 'badge-ghost' },
};

const STATUS_FALLBACK_BADGE = 'badge-ghost';

const URGENCY_LABELS: Record<string, string> = {
  ALTA: 'Urgente',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

const URGENCY_BADGES: Record<string, string> = {
  ALTA: 'badge-error',
  MEDIA: 'badge-warning',
  BAJA: 'badge-ghost',
};

const SHARE_LEVEL_LABELS: Record<string, string> = {
  FULL: 'Ficha completa (FULL)',
  CLINICAL: 'Solo clínico (CLINICAL)',
};

const SHARE_LEVEL_HINTS: Record<string, string> = {
  FULL: 'El especialista ve la ficha completa y los documentos del paciente.',
  CLINICAL: 'El especialista ve lo clínico sin datos personales del tutor (RGPD).',
};

const UNLOCKED_STATUSES = ['ACCEPTED', 'SCHEDULED', 'COMPLETED'];

const SLOT_ISO_KEYS = ['slot_iso', 'iso', 'start', 'datetime', 'when_iso', 'value'];

function normalizedKey(value: unknown): string {
  return String(value ?? '').toUpperCase();
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return DASH;
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return DASH;
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0 && !String(value).includes('T');
  if (isMidnight) return formatDate(value);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value)} · ${hh}:${mm}`;
}

export function formatWeekday(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '';
  return WEEKDAYS_ES[date.getDay()];
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

export function formatPreferredSlots(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw
    .split(',')
    .map((part) => {
      const candidate = part.trim();
      return ISO_DATETIME_RE.test(candidate) ? formatDateTime(candidate) : candidate;
    })
    .filter(Boolean)
    .join(', ');
}

function monthsLabel(months: number): string {
  if (months === 1) return '1 mes';
  return `${months} meses`;
}

function yearsLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} años` : `${years} años y ${rest} m`;
}

export function ageFromBirthDate(birthDate: string | null | undefined): string {
  const date = parseDate(birthDate);
  if (!date) return DASH;
  const now = new Date();
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months -= 1;
  if (months < 0) return DASH;
  if (months < 24) return monthsLabel(Math.max(months, 0));
  return yearsLabel(months);
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) return DASH;
  return `${Number(kg).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Consultar';
  return `${Number(value).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;
}

function minutesLabel(diffMin: number): string {
  if (diffMin === 0) return 'ahora';
  return diffMin > 0 ? `en ${diffMin} min` : `hace ${Math.abs(diffMin)} min`;
}

function hoursLabel(diffH: number): string {
  return diffH > 0 ? `en ${diffH} h` : `hace ${Math.abs(diffH)} h`;
}

function daysLabel(diffD: number): string {
  if (diffD === 1) return 'en 1 día';
  if (diffD === -1) return 'hace 1 día';
  return diffD > 0 ? `en ${diffD} días` : `hace ${Math.abs(diffD)} días`;
}

export function relativeTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return DASH;
  const diffMin = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(diffMin) < 60) return minutesLabel(diffMin);
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return hoursLabel(diffH);
  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 30) return daysLabel(diffD);
  return formatDate(value);
}

export function normalizeRole(role: Role | null | undefined): 'CLINIC' | 'SPECIALIST' | 'UNKNOWN' {
  const value = String(role ?? '').toUpperCase();
  if (value.startsWith('SPEC') || value === 'VET_SPECIALIST' || value.includes('SPECIALIST')) {
    return 'SPECIALIST';
  }
  if (value.startsWith('CLIN') || value.includes('CLINIC') || value === 'VET') return 'CLINIC';
  return 'UNKNOWN';
}

export function isSpecialist(user: User | null | undefined): boolean {
  return normalizeRole(user?.role) === 'SPECIALIST';
}

export function roleLabel(user: User | null | undefined): string {
  const role = normalizeRole(user?.role);
  if (role === 'SPECIALIST') return 'Especialista';
  if (role === 'CLINIC') return 'Clínica';
  return 'Demo';
}

export function severityStyle(severity: AlertSeverity | null | undefined): SeverityStyle {
  return lookupValue(SEVERITY_STYLES, normalizedKey(severity), SEVERITY_FALLBACK);
}

export function severityRank(severity: AlertSeverity | null | undefined): number {
  return SEVERITY_ORDER[normalizedKey(severity)] ?? 5;
}

export function requestStatusStyle(status: string | null | undefined): StatusStyle {
  const fallback: StatusStyle = {
    label: status ? String(status) : 'Sin estado',
    badge: STATUS_FALLBACK_BADGE,
  };
  return lookupValue(REQUEST_STATUS_STYLES, normalizedKey(status), fallback);
}

export function isUnlockedStatus(status: string | null | undefined): boolean {
  return UNLOCKED_STATUSES.includes(normalizedKey(status));
}

export function urgencyLabel(urgency: string | null | undefined): string {
  return lookupValue(URGENCY_LABELS, normalizedKey(urgency), urgency ? String(urgency) : 'Sin especificar');
}

export function urgencyBadge(urgency: string | null | undefined): string {
  return lookupValue(URGENCY_BADGES, normalizedKey(urgency), STATUS_FALLBACK_BADGE);
}

export function shareLevelLabel(level: string | null | undefined): string {
  return lookupValue(SHARE_LEVEL_LABELS, normalizedKey(level), SHARE_LEVEL_LABELS.CLINICAL);
}

export function shareLevelHint(level: string | null | undefined): string {
  return lookupValue(SHARE_LEVEL_HINTS, normalizedKey(level), SHARE_LEVEL_HINTS.CLINICAL);
}

export function slotIso(slot: unknown): string {
  if (typeof slot === 'string') return slot.trim();
  if (!slot || typeof slot !== 'object') return '';
  const record = slot as Record<string, unknown>;
  for (const key of SLOT_ISO_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function slotText(slot: object): string {
  const record = slot as Record<string, unknown>;
  const explicit = record.label ?? record.text;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  const iso = slotIso(record);
  if (!iso) return 'Franja disponible';
  return `${formatWeekday(iso)} ${formatDateTime(iso)}`;
}

export function slotLabel(slot: unknown): string {
  if (typeof slot === 'string') {
    return slot ? `${formatWeekday(slot)} ${formatDateTime(slot)}` : '';
  }
  if (!slot || typeof slot !== 'object') return '';
  return slotText(slot);
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
