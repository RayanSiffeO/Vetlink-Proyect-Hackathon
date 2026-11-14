import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  IdCard,
  PawPrint,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import AlertCard, { sortAlerts } from '../components/AlertCard';
import { AlertCountChips } from '../components/AlertCountChips';
import { BackLink } from '../components/BackLink';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { PatientReviewBanner } from '../components/patients/PatientReviewBanner';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { usePatientRecord } from '../api/hooks';
import type { CanonicalRecord, Encounter, PatientRecordResponse, ProvenanceSummary } from '../api/types';
import { formatDate, formatDateTime, formatWeight } from '../lib/format';
import {
  countCriticalAlerts,
  patientFacts,
  sexLabel,
  sortEncounters,
  type PatientFacts,
} from '../lib/patients';

function RecordNameRow({
  name,
  status,
  criticalCount,
}: {
  name: string;
  status: string | null;
  criticalCount: number;
}) {
  const criticalLabel =
    criticalCount === 1 ? 'alerta prioritaria' : 'alertas prioritarias';
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <h1 className="text-[40px] font-medium leading-[44px] tracking-[-0.035em] text-ink sm:text-[54px] sm:leading-[58px]">
        {name}
      </h1>
      {status ? (
        <span className="rounded-full border border-indigo-100 bg-white/55 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] leading-4 text-indigo-700">
          {status}
        </span>
      ) : null}
      {criticalCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-crit/15 bg-white/55 px-2.5 py-1 text-[11px] font-medium leading-4 text-crit">
          <span className="h-1.5 w-1.5 rounded-full bg-crit" aria-hidden="true" />
          {criticalCount} {criticalLabel}
        </span>
      ) : null}
    </div>
  );
}

function RecordSpeciesLine({ facts }: { facts: PatientFacts }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-para">
      <PawPrint className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />
      <span>{facts.species}</span>
      <span className="text-line-strong">·</span>
      <span>{facts.breed}</span>
      {facts.sex ? (
        <>
          <span className="text-line-strong">·</span>
          <span>{sexLabel(facts.sex)}</span>
        </>
      ) : null}
    </p>
  );
}

function RecordActions() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Link
        to={`/specialists?patient_id=${id ?? ''}`}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line-strong bg-white/70 px-3.5 py-2 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-soft"
      >
        <Stethoscope className="h-3.5 w-3.5" />
        Buscar especialista
      </Link>
      <Link
        to={`/requests/new?patient_id=${id ?? ''}`}
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-cream shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26]"
      >
        <Send className="h-3.5 w-3.5" />
        Nueva solicitud
      </Link>
    </div>
  );
}

interface VitalItem {
  label: string;
  value: string;
  icon: typeof CalendarClock;
}

function vitalItems(facts: PatientFacts): VitalItem[] {
  return [
    { label: 'Edad', value: facts.age, icon: CalendarClock },
    { label: 'Peso', value: facts.weight, icon: PawPrint },
    { label: 'BCS', value: facts.bcs ? `${facts.bcs} / 9` : '—', icon: ClipboardList },
    { label: 'Microchip', value: facts.microchip, icon: IdCard },
    { label: 'Nacimiento', value: formatDate(facts.birthDate), icon: CalendarClock },
    { label: 'Tutor', value: facts.owner, icon: UserRound },
  ];
}

function VitalCell({ item }: { item: VitalItem }) {
  const Icon = item.icon;
  return (
    <div className="min-w-0 rounded-2xl border border-white/55 bg-white/35 px-3 py-2.5">
      <dt className="vl-label flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-indigo-300" aria-hidden="true" />
        {item.label}
      </dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-ink" title={item.value}>
        {item.value}
      </dd>
    </div>
  );
}

function RecordVitals({ facts }: { facts: PatientFacts }) {
  return (
    <dl className="grid grid-cols-2 gap-2 border-t border-white/60 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6">
      {vitalItems(facts).map((item) => (
        <VitalCell key={item.label} item={item} />
      ))}
    </dl>
  );
}

function RecordHeaderCard({ data }: { data: PatientRecordResponse }) {
  const facts = patientFacts(data.patient);
  const alerts = sortAlerts(data.alerts ?? data.record?.alerts ?? []);
  const encounters = sortEncounters(data.record?.encounters);
  const criticalCount = countCriticalAlerts(alerts);
  const provenance = data.provenance_summary ?? data.record?.provenance_summary ?? null;
  return (
    <header className="glass overflow-hidden rounded-panel">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,221,196,0.72))] text-xl font-medium tracking-tight text-indigo-700 shadow-soft">
              {facts.initial}
            </span>
            <div className="min-w-0">
              <p className="vl-section-title text-indigo-700">Ficha canónica</p>
              <div className="mt-1">
                <RecordNameRow name={facts.name} status={facts.status} criticalCount={criticalCount} />
              </div>
              <RecordSpeciesLine facts={facts} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProvenanceBadge summary={provenance} alerts={alerts.length} />
                <span className="rounded-full border border-white/60 bg-white/40 px-2.5 py-1 text-[11px] leading-4 text-caption">
                  {alerts.length} alertas · {encounters.length} encuentros
                </span>
              </div>
            </div>
          </div>
          <RecordActions />
        </div>
      </div>
      <RecordVitals facts={facts} />
    </header>
  );
}

function alertCounts(alerts: ReturnType<typeof sortAlerts>): Record<string, number> {
  return alerts.reduce<Record<string, number>>((counts, alert) => {
    const key = String(alert.severity ?? '').toUpperCase();
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function RecordAlertsSection({ alerts }: { alerts: ReturnType<typeof sortAlerts> }) {
  const counts = alertCounts(alerts);
  return (
    <section aria-label="Alertas clínicas" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="vl-section-title">Seguridad clínica</p>
          <h2 className="mt-1 text-h2 text-ink">Alertas</h2>
        </div>
        <AlertCountChips counts={counts} />
      </div>
      {alerts.length === 0 ? (
        <EmptyState
          title="Sin alertas"
          description="El motor de reglas no ha detectado riesgos en este registro."
        />
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </section>
  );
}

function EncounterHeadline({ encounter }: { encounter: Encounter }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] leading-4 text-indigo-700">
        {formatDate(encounter.date)}
      </span>
      {encounter.type ? (
        <span className="rounded-full border border-line-strong/80 bg-white/70 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] leading-3 text-caption">
          {String(encounter.type).replace(/_/g, ' ')}
        </span>
      ) : null}
      {encounter.vitals?.weight_kg ? (
        <span className="text-[11px] leading-4 text-caption">
          {formatWeight(encounter.vitals.weight_kg)}
        </span>
      ) : null}
    </div>
  );
}

function EncounterClinicLine({
  clinic,
  clinicianRef,
}: {
  clinic: string | null;
  clinicianRef?: string | null;
}) {
  if (!clinic && !clinicianRef) return null;
  return (
    <p className="mt-1 truncate text-[11px] leading-4 text-caption">
      {[clinic, clinicianRef].filter(Boolean).join(' · ')}
    </p>
  );
}

function encounterText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function encounterNote(encounter: Encounter): string {
  const explicit = encounterText(encounter.note);
  if (explicit) return explicit;
  const soap = encounter.soap;
  if (soap && typeof soap === 'object') {
    return encounterText((soap as Record<string, unknown>).P);
  }
  return '';
}

function encounterDiagnosis(encounter: Encounter, note: string): string {
  const diagnosis = encounterText(encounter.diagnosis_summary);
  if (!diagnosis) return '';
  if (note && (diagnosis === note || diagnosis === note.slice(0, 140))) return '';
  return diagnosis;
}

function EncounterNotes({ encounter }: { encounter: Encounter }) {
  const clinic =
    typeof encounter.clinic === 'string' ? encounter.clinic : encounter.clinic?.name ?? null;
  const note = encounterNote(encounter);
  const diagnosis = encounterDiagnosis(encounter, note);
  const recommendations = note ? encounterText(encounter.recommendations) : '';
  const nextVisit = note ? encounterText(encounter.next_visit_date) : '';
  return (
    <>
      <p className="mt-0.5 text-[13.5px] font-medium leading-5 text-ink">
        {encounter.reason ?? 'Visita sin motivo registrado'}
      </p>
      {note ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-mist/80 px-2.5 py-1.5 text-[12px] leading-[18px] text-para">
          <span className="font-semibold text-ink">Nota de la visita: </span>
          {note}
        </p>
      ) : null}
      {diagnosis ? (
        <p className="mt-1.5 rounded-xl bg-mist/80 px-2.5 py-1.5 text-[12px] leading-[18px] text-para">
          <span className="font-semibold text-ink">Diagnóstico: </span>
          {diagnosis}
        </p>
      ) : null}
      {recommendations ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-mist/80 px-2.5 py-1.5 text-[12px] leading-[18px] text-para">
          <span className="font-semibold text-ink">Recomendaciones: </span>
          {recommendations}
        </p>
      ) : null}
      {nextVisit ? (
        <p className="mt-1.5 text-[11px] leading-4 text-caption">
          <span className="font-semibold text-ink">Próxima revisión: </span>
          {formatDate(nextVisit)}
        </p>
      ) : null}
      <EncounterClinicLine clinic={clinic} clinicianRef={encounter.clinician_ref} />
    </>
  );
}

function EncounterRow({ encounter }: { encounter: Encounter }) {
  return (
    <li className="glass-soft rounded-2xl p-4 transition duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/60 bg-white/45 text-indigo-700">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <EncounterHeadline encounter={encounter} />
          <EncounterNotes encounter={encounter} />
        </div>
      </div>
    </li>
  );
}

function RecordEncountersSection({ encounters }: { encounters: Encounter[] }) {
  return (
    <section aria-label="Encuentros" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="vl-section-title">Historia clínica</p>
          <h2 className="mt-1 text-h2 text-ink">Encuentros</h2>
        </div>
        <span className="rounded-full border border-line bg-white/50 px-3 py-1 text-[11px] text-caption">
          {encounters.length} visitas · más reciente primero
        </span>
      </div>
      {encounters.length === 0 ? (
        <EmptyState
          title="Sin encuentros registrados"
          description="La historia importada no contiene visitas con fecha."
        />
      ) : (
        <ol className="space-y-2.5">
          {encounters.map((encounter, index) => (
            <EncounterRow key={encounter.id ?? `${encounter.date}-${index}`} encounter={encounter} />
          ))}
        </ol>
      )}
    </section>
  );
}

interface ReminderItem {
  id: string;
  text: string;
  due: string;
  status: string;
}

function remindersOf(record: CanonicalRecord | null | undefined): ReminderItem[] {
  const raw = record?.reminders;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      text: String(item.text ?? ''),
      due: typeof item.due === 'string' ? item.due : '',
      status: String(item.status ?? '').toUpperCase(),
    }))
    .filter((item) => item.text !== '')
    .sort((a, b) => a.due.localeCompare(b.due));
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

interface ReminderTone {
  dot: string;
  chip: string;
  label: string;
}

function reminderTone(reminder: ReminderItem): ReminderTone | null {
  if (reminder.status === 'OVERDUE') {
    return { dot: 'bg-crit', chip: 'border-crit/20 bg-crit-soft text-crit', label: 'Vencido' };
  }
  if (reminder.status === 'DUE') {
    const isToday = reminder.due === todayIso();
    return {
      dot: 'bg-indigo',
      chip: 'border-indigo-100 bg-indigo-50 text-indigo-700',
      label: isToday ? 'Hoy' : 'Pendiente',
    };
  }
  return null;
}

function ReminderRow({ reminder }: { reminder: ReminderItem }) {
  const tone = reminderTone(reminder);
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone?.dot ?? 'bg-indigo-300'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium leading-4 text-ink">{reminder.text}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-caption">{formatDate(reminder.due)}</p>
      </div>
      {tone ? (
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em] leading-3 ${tone.chip}`}
        >
          {tone.label}
        </span>
      ) : null}
    </li>
  );
}

function PreventivePlanCard({ reminders }: { reminders: ReminderItem[] }) {
  if (reminders.length === 0) return null;
  return (
    <section className="glass rounded-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="vl-section-title text-indigo-700">Plan preventivo</h2>
        <span className="text-[11px] leading-4 text-caption">{reminders.length} hitos</span>
      </div>
      <ul className="mt-2 divide-y divide-line/70">
        {reminders.slice(0, 4).map((reminder) => (
          <ReminderRow key={reminder.id || reminder.text} reminder={reminder} />
        ))}
      </ul>
    </section>
  );
}

function provenanceAlertCount(summary: ProvenanceSummary | null | undefined): number {
  const raw = summary?.alerts;
  if (raw && typeof raw === 'object') return Number((raw as { total?: number }).total ?? 0);
  return Number(raw ?? 0);
}

function ProvenanceRailCard({
  summary,
}: {
  summary: ProvenanceSummary | null | undefined;
}) {
  const fields = Number(summary?.fields_populated ?? 0);
  const entities = Number(summary?.entities ?? 0);
  const alerts = provenanceAlertCount(summary);
  const source = summary?.source_system ?? null;
  return (
    <section className="glass rounded-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="vl-section-title text-indigo-700">De dónde viene</h2>
        <span className="text-[11px] leading-4 text-caption">{fields} campos</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-[38px] font-medium leading-none tracking-[-0.04em] text-ink">
          {fields.toLocaleString('es-ES')}
        </p>
        <p className="pb-1 text-[11px] leading-4 text-caption">campos</p>
      </div>
      <p className="mt-1 text-[12px] leading-[18px] text-caption">
        {entities} entidades · {alerts} alertas
      </p>
      {source ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white/60 px-2.5 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-para">
            {source}
          </span>
        </div>
      ) : null}
      {summary?.imported_at ? (
        <p className="mt-3 border-t border-white/80 pt-2.5 text-[10.5px] leading-4 text-caption">
          Importado {formatDateTime(summary.imported_at)}
        </p>
      ) : null}
    </section>
  );
}

function briefingText(briefing: Record<string, unknown>, key: string): string | null {
  const value = briefing[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function briefingListLength(briefing: Record<string, unknown>, key: string): number {
  const value = briefing[key];
  return Array.isArray(value) ? value.length : 0;
}

function BriefingRailCard({
  briefing,
  patientId,
}: {
  briefing: Record<string, unknown> | null | undefined;
  patientId: string;
}) {
  if (!briefing) return null;
  const headline = briefingText(briefing, 'headline');
  const actions = briefingListLength(briefing, 'priority_actions');
  const gaps = briefingListLength(briefing, 'data_gaps');
  return (
    <Link
      to={`/requests/new?patient_id=${patientId}`}
      className="group relative block overflow-hidden rounded-panel bg-ink p-5 text-cream shadow-lift transition duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26] hover:shadow-card"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/10 text-cream">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-cream/60">
          Briefing pre-visita
        </h2>
        <ArrowRight className="ml-auto h-4 w-4 text-cream/70 transition duration-200 ease-smooth group-hover:translate-x-0.5" />
      </div>
      {headline ? (
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-[19px] text-cream">{headline}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium leading-4 text-cream/75">
          {actions} acciones prioritarias
        </span>
        {gaps > 0 ? (
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium leading-4 text-cream/75">
            {gaps} datos que faltan
          </span>
        ) : null}
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-cream">
        Preparar solicitud
      </span>
    </Link>
  );
}

function PatientNotFound() {
  return (
    <EmptyState
      title="Paciente no encontrado"
      description="La ficha solicitada no existe o se ha reiniciado la demo."
      action={
        <Link to="/patients" className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm">
          Volver a pacientes
        </Link>
      }
    />
  );
}

export function PatientRecord() {
  const { id } = useParams<{ id: string }>();
  const query = usePatientRecord(id);

  if (query.isLoading) return <Loading label="Cargando la ficha canónica…" />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudo cargar la ficha del paciente"
        onRetry={() => query.refetch()}
        hint="El registro canónico se genera al importar la historia"
      />
    );
  }
  if (!query.data?.patient) return <PatientNotFound />;

  const data = query.data;
  const alerts = sortAlerts(data.alerts ?? data.record?.alerts ?? []);
  const encounters = sortEncounters(data.record?.encounters);
  const provenance = data.provenance_summary ?? data.record?.provenance_summary ?? null;
  const reminders = remindersOf(data.record);
  const patientId = id ?? '';

  return (
    <div className="space-y-5">
      <BackLink to="/patients">Pacientes</BackLink>
      <RecordHeaderCard data={data} />
      <PatientReviewBanner patientId={patientId} review={data.record?.review ?? null} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <RecordAlertsSection alerts={alerts} />
          <RecordEncountersSection encounters={encounters} />
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ProvenanceRailCard summary={provenance} />
          <PreventivePlanCard reminders={reminders} />
          <BriefingRailCard briefing={data.briefing} patientId={patientId} />
        </aside>
      </div>
    </div>
  );
}

export default PatientRecord;
