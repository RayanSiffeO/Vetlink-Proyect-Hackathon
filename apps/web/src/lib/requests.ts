import type { CreateRequestPayload, ShareLevel, Urgency } from '../api/types';

export const MOTIVO_MIN_LENGTH = 10;
export const MOTIVO_MAX_LENGTH = 600;

export type RequestTab = 'detail' | 'briefing' | 'audit';

const LOCKED_ACTION_STATUSES = ['COMPLETED', 'CANCELLED', 'DECLINED'];
const CLOSEABLE_STATUSES = ['ACCEPTED', 'SCHEDULED'];

export interface RequestPresets {
  patientId: string;
  specialistId: string;
  slot: string;
}

export interface RequestFormState {
  patientId: string;
  specialistId: string;
  motivo: string;
  urgencia: Urgency;
  shareLevel: ShareLevel;
  preferredText: string;
  touched: boolean;
  presetSlot: string;
}

export type RequestFormPatch = Partial<RequestFormState>;

export function readRequestPresets(searchParams: URLSearchParams): RequestPresets {
  return {
    patientId: searchParams.get('patient_id') ?? '',
    specialistId: searchParams.get('specialist_id') ?? '',
    slot: searchParams.get('slot') ?? '',
  };
}

export function createRequestFormState(presets: RequestPresets): RequestFormState {
  return {
    patientId: presets.patientId,
    specialistId: presets.specialistId,
    motivo: '',
    urgencia: 'MEDIA',
    shareLevel: 'CLINICAL',
    preferredText: '',
    touched: false,
    presetSlot: presets.slot,
  };
}

export function preferredSlotList(form: RequestFormState): string[] {
  const typed = form.preferredText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return [...(form.presetSlot ? [form.presetSlot] : []), ...typed];
}

export function buildCreatePayload(form: RequestFormState): CreateRequestPayload {
  return {
    patient_id: form.patientId,
    specialist_id: form.specialistId,
    motivo: form.motivo.trim(),
    urgencia: form.urgencia,
    share_level: form.shareLevel,
    preferred: preferredSlotList(form).join(', '),
  };
}

export function isRequestFormComplete(form: RequestFormState): boolean {
  const hasSelection = Boolean(form.patientId && form.specialistId);
  return hasSelection && form.motivo.trim().length >= MOTIVO_MIN_LENGTH;
}

export function motivoValidationError(form: RequestFormState): string | null {
  if (!form.touched) return null;
  if (form.motivo.trim().length >= MOTIVO_MIN_LENGTH) return null;
  return `Describe el motivo (mínimo ${MOTIVO_MIN_LENGTH} caracteres).`;
}

export function resolveRequestTab(tabParam: string | null): RequestTab {
  if (tabParam === 'briefing' || tabParam === 'audit') return tabParam;
  return 'detail';
}

export function toIsoFromLocal(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function canCancelRequest(status: string, specialistRole: boolean): boolean {
  return !specialistRole && !LOCKED_ACTION_STATUSES.includes(status);
}

export function isCloseableStatus(status: string | null | undefined): boolean {
  return CLOSEABLE_STATUSES.includes(String(status ?? '').toUpperCase());
}

export function isHighUrgency(urgency: string | null | undefined): boolean {
  return String(urgency ?? '').toUpperCase() === 'ALTA';
}
