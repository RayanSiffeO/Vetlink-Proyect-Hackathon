export type Role = 'CLINIC' | 'SPECIALIST' | 'ADMIN' | string;

export interface User {
  id: string;
  username?: string;
  display_name: string;
  role: Role;
  clinic_id?: string | null;
  specialty?: string | null;
}

export interface MeResponse {
  user: User | null;
}

export interface LoginResponse {
  user: User;
}

export type DemoUserId = 'laura' | 'marc';

export interface PatientSummary {
  id: string;
  name: string;
  species?: string | null;
  species_label?: string | null;
  breed?: string | null;
  breed_label?: string | null;
  birth_date?: string | null;
  weight_current_kg?: number | null;
  bcs?: number | null;
  microchip?: string | null;
  owner_display?: string | null;
  identity_confidence?: number | null;
  alerts_count?: number | null;
}

export interface PatientsResponse {
  patients: PatientSummary[];
  count?: number;
  requested_by?: string;
}

export interface CanonicalPatient {
  id: string;
  name?: string | null;
  species?: string | null;
  species_code?: string | null;
  species_label?: string | null;
  breed?: string | null;
  breed_label?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  weight_current_kg?: number | null;
  bcs?: number | null;
  microchip?: string | null;
  owner_display?: string | null;
  colour?: string | null;
  coat?: string | null;
  status?: string | null;
  identity_confidence?: number | null;
  [key: string]: unknown;
}

export interface Encounter {
  id?: string;
  date?: string | null;
  time?: string | null;
  type?: string | null;
  reason?: string | null;
  diagnosis_summary?: string | null;
  clinic?: { name?: string | null; code?: string | null } | string | null;
  clinician_ref?: string | null;
  status?: string | null;
  vitals?: { weight_kg?: number | null } | null;
  [key: string]: unknown;
}

export interface AlertEvidence {
  entity?: string | null;
  id?: string | null;
  source_system?: string | null;
  source_ref?: string | null;
  label?: string | null;
  [key: string]: unknown;
}

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  category?: string | null;
  title: string;
  message?: string | null;
  evidence?: Array<AlertEvidence | string> | null;
  action?: string | null;
  code?: string | null;
  [key: string]: unknown;
}

export interface ProvenanceSummary {
  entities?: number | null;
  fields_populated?: number | null;
  alerts?: number | { total?: number; by_severity?: Record<string, number> } | null;
  source_system?: string | null;
  record_version?: number | null;
  imported_at?: string | null;
  [key: string]: unknown;
}

export interface ReviewCriticalField {
  field?: string | null;
  entity_id?: string | null;
  type?: string | null;
  review_required?: boolean | null;
  reason?: string | null;
  [key: string]: unknown;
}

export interface ReviewSummary {
  policy?: string | null;
  critical_fields?: Array<ReviewCriticalField | string> | null;
  pending_review?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewed_fields?: string[] | null;
  note?: string | null;
  [key: string]: unknown;
}

export interface CanonicalRecord {
  record_id?: string;
  patient?: CanonicalPatient | null;
  encounters?: Encounter[];
  alerts?: AlertItem[];
  problems?: unknown[];
  provenance_summary?: ProvenanceSummary | null;
  review?: ReviewSummary | null;
  [key: string]: unknown;
}

export interface PatientRecordResponse {
  patient: PatientSummary;
  record: CanonicalRecord | null;
  alerts: AlertItem[];
  provenance_summary?: ProvenanceSummary | null;
  briefing?: Record<string, unknown> | null;
  record_meta?: RecordMeta | null;
}

export interface RecordMeta {
  id?: string | null;
  source_system?: string | null;
  record_version?: number | null;
  imported_at?: string | null;
  alerts_count?: number | null;
}

export interface ReviewRecordPayload {
  reviewed_fields?: string[];
  note?: string | null;
}

export interface ReviewResponse {
  patient: PatientSummary;
  record: RecordMeta;
  review: ReviewSummary;
}

export type ImportFileStatus = 'UPLOADING' | 'PARSING' | 'NEEDS_REVIEW' | 'READY' | 'FAILED' | string;

export interface ImportFileResult {
  job_id?: string;
  filename: string;
  status: ImportFileStatus;
  record_id?: string | null;
  message?: string | null;
}

export interface ImportResponse {
  job_id: string;
  files: ImportFileResult[];
  summary?: { total: number; ready: number; needs_review: number };
}

export interface Specialist {
  id: string;
  name: string;
  specialty: string;
  zone: string;
  price_from?: number | null;
  bio?: string | null;
  next_slot?: string | null;
  [key: string]: unknown;
}
export type AvailableSlot = string | { slot_iso?: string; label?: string; duration_min?: number };

export interface SpecialistsResponse {
  specialists: Specialist[];
  count?: number;
  filters?: { specialty?: string | null; zone?: string | null };
}

export interface SpecialistDetailResponse {
  specialist: Specialist;
  available_slots: AvailableSlot[];
  slots_count?: number;
}

export type RequestStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | string;

export type ShareLevel = 'CLINICAL' | 'FULL';
export type Urgency = 'BAJA' | 'MEDIA' | 'ALTA';

export interface RequestRecord {
  id: string;
  status: RequestStatus;
  patient_id?: string | null;
  specialist_id?: string | null;
  created_by?: string | null;
  motivo?: string | null;
  urgencia?: Urgency | string | null;
  share_level?: ShareLevel | string | null;
  preferred?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  patient_name?: string | null;
  patient_species?: string | null;
  specialist_name?: string | null;
  specialist_specialty?: string | null;
  [key: string]: unknown;
}
export interface PublicPatient {
  species?: string | null;
  species_code?: string | null;
  breed?: string | null;
  age?: string | null;
  sex?: string | null;
  neutered?: boolean | null;
  weight_kg?: number | null;
  bcs?: number | null;
  bcs_scale?: string | null;
  chronic_conditions?: string[] | null;
}

export interface PublicAlertRef {
  severity: AlertSeverity;
  category?: string | null;
  title: string;
}

export interface PriorityAction {
  severity: AlertSeverity;
  title: string;
  action: string;
}

export interface PublicSummary {
  request_id?: string;
  status?: RequestStatus;
  created_at?: string | null;
  urgencia?: string | null;
  share_level?: string | null;
  motivo?: string | null;
  preferred?: string | null;
  patient?: PublicPatient | null;
  headline?: string | null;
  alert_counts?: Record<string, number> | null;
  priority_actions?: PriorityAction[] | null;
  alerts?: PublicAlertRef[] | null;
  alerts_total?: number | null;
  data_freshness_days?: number | null;
  data_gaps?: string[] | null;
  privacy?: {
    level?: string;
    excluded?: string[];
    note?: string;
  } | null;
  service?: {
    specialist_id?: string | null;
    specialist?: string | null;
    specialty?: string | null;
    zone?: string | null;
    price_from?: number | null;
    next_slot?: string | null;
  } | null;
}

export interface RequestPatientSummary {
  id: string;
  name: string;
  owner_display?: string | null;
  microchip?: string | null;
  patient?: PublicPatient | null;
  headline?: string | null;
  alert_counts?: Record<string, number> | null;
}

export interface RequestsResponse {
  requests: RequestRecord[];
  count?: number;
  scope?: string;
}

export interface RequestDetailResponse {
  request: RequestRecord;
  patient_summary?: RequestPatientSummary | null;
  specialist?: Specialist | null;
}

export interface BriefingBody {
  headline?: string | null;
  patient_label?: string | null;
  alert_counts?: Record<string, number> | null;
  priority_actions?: PriorityAction[] | null;
  data_freshness_days?: number | null;
  data_gaps?: string[] | null;
  alerts_rendered?: AlertItem[] | null;
  alerts_total?: number | null;
}
export interface BriefingResponse {
  request?: RequestRecord;
  briefing?: BriefingBody | null;
  record?: CanonicalRecord | null;
  record_meta?: RecordMeta | null;
  patient_summary?: RequestPatientSummary | null;
  specialist?: Specialist | null;
  audit?: AuditEvent[];
  unlocked_at?: string | null;
}

export interface AuditEvent {
  id?: string;
  actor?: string | null;
  role?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  created_at?: string | null;
  detail?: string | null;
  [key: string]: unknown;
}

export interface AuditResponse {
  events: AuditEvent[];
  count?: number;
}

export interface Appointment {
  id: string;
  request_id?: string | null;
  when_iso: string;
  status: string;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_species?: string | null;
  specialist_id?: string | null;
  specialist_name?: string | null;
  specialty?: string | null;
  motivo?: string | null;
  urgencia?: string | null;
  request_status?: string | null;
  [key: string]: unknown;
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  count?: number;
  range?: { from?: string | null; to?: string | null };
}

export interface CreateRequestPayload {
  patient_id: string;
  specialist_id: string;
  motivo: string;
  urgencia: Urgency;
  share_level: ShareLevel;
  preferred: string;
}

export interface ResetResponse {
  ok?: boolean;
  message?: string;
  [key: string]: unknown;
}
