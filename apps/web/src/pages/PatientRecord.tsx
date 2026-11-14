import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  IdCard,
  PawPrint,
  Send,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import AlertCard, { sortAlerts } from '../components/AlertCard';
import { BackLink } from '../components/BackLink';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { PatientReviewBanner } from '../components/patients/PatientReviewBanner';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { usePatientRecord } from '../api/hooks';
import type { Encounter, PatientRecordResponse } from '../api/types';
import { formatDate, formatWeight } from '../lib/format';
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
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
      {status ? <span className="badge badge-sm badge-ghost uppercase">{status}</span> : null}
      {criticalCount > 0 ? (
        <span className="badge badge-error badge-sm font-semibold">
          {criticalCount} {criticalLabel}
        </span>
      ) : null}
    </div>
  );
}

function RecordSpeciesLine({ facts }: { facts: PatientFacts }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/60">
      <PawPrint className="h-4 w-4 text-secondary" aria-hidden="true" />
      <span>{facts.species}</span>
      <span className="text-base-content/30">·</span>
      <span>{facts.breed}</span>
      {facts.sex ? (
        <>
          <span className="text-base-content/30">·</span>
          <span>{sexLabel(facts.sex)}</span>
        </>
      ) : null}
    </p>
  );
}

function RecordActions() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Link to={`/specialists?patient_id=${id ?? ''}`} className="btn btn-outline btn-sm gap-1.5">
        <Stethoscope className="h-4 w-4" />
        Buscar especialista
      </Link>
      <Link to={`/requests/new?patient_id=${id ?? ''}`} className="btn btn-primary btn-sm gap-1.5">
        <Send className="h-4 w-4" />
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
    <div className="bg-base-100 px-4 py-3">
      <dt className="vl-label flex items-center gap-1.5">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {item.label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold" title={item.value}>
        {item.value}
      </dd>
    </div>
  );
}

function RecordVitals({ facts }: { facts: PatientFacts }) {
  return (
    <dl className="grid grid-cols-2 gap-px border-t border-base-300/70 bg-base-300/50 sm:grid-cols-3 lg:grid-cols-6">
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
    <header className="vl-card overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-content">
          {facts.initial}
        </span>
        <div className="min-w-0 flex-1">
          <RecordNameRow name={facts.name} status={facts.status} criticalCount={criticalCount} />
          <RecordSpeciesLine facts={facts} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ProvenanceBadge summary={provenance} alerts={alerts.length} />
            <span className="text-[11px] text-base-content/45">
              {alerts.length} alertas · {encounters.length} encuentros
            </span>
          </div>
        </div>
        <RecordActions />
      </div>
      <RecordVitals facts={facts} />
    </header>
  );
}

function RecordAlertsSection({ alerts }: { alerts: ReturnType<typeof sortAlerts> }) {
  return (
    <section aria-label="Alertas clínicas" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/55">
          Alertas ({alerts.length})
        </h2>
        <span className="text-[11px] text-base-content/40">ordenadas por severidad</span>
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
      <span className="text-sm font-semibold">{formatDate(encounter.date)}</span>
      {encounter.type ? (
        <span className="badge badge-xs badge-ghost uppercase">
          {String(encounter.type).replace(/_/g, ' ')}
        </span>
      ) : null}
      {encounter.vitals?.weight_kg ? (
        <span className="text-[11px] text-base-content/45">
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
    <p className="mt-1 truncate text-[11px] text-base-content/40">
      {[clinic, clinicianRef].filter(Boolean).join(' · ')}
    </p>
  );
}

function EncounterNotes({ encounter }: { encounter: Encounter }) {
  const clinic =
    typeof encounter.clinic === 'string' ? encounter.clinic : encounter.clinic?.name ?? null;
  return (
    <>
      <p className="mt-0.5 text-[13px] leading-snug text-base-content/75">
        {encounter.reason ?? 'Visita sin motivo registrado'}
      </p>
      {encounter.diagnosis_summary ? (
        <p className="mt-1 rounded-lg bg-base-200/70 px-2 py-1 text-[12px] text-base-content/60">
          <span className="font-semibold text-base-content/70">Diagnóstico: </span>
          {encounter.diagnosis_summary}
        </p>
      ) : null}
      <EncounterClinicLine clinic={clinic} clinicianRef={encounter.clinician_ref} />
    </>
  );
}

function EncounterRow({ encounter }: { encounter: Encounter }) {
  return (
    <li className="flex gap-3 p-4">
      <div className="flex flex-col items-center pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-secondary ring-4 ring-secondary/15" />
        <span className="mt-1 w-px flex-1 bg-base-300" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <EncounterHeadline encounter={encounter} />
        <EncounterNotes encounter={encounter} />
      </div>
    </li>
  );
}

function RecordEncountersSection({ encounters }: { encounters: Encounter[] }) {
  return (
    <section aria-label="Encuentros" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/55">
          Encuentros ({encounters.length})
        </h2>
        <span className="text-[11px] text-base-content/40">más reciente primero</span>
      </div>
      {encounters.length === 0 ? (
        <EmptyState
          title="Sin encuentros registrados"
          description="La historia importada no contiene visitas con fecha."
        />
      ) : (
        <ol className="vl-card divide-y divide-base-300/60">
          {encounters.map((encounter, index) => (
            <EncounterRow key={encounter.id ?? `${encounter.date}-${index}`} encounter={encounter} />
          ))}
        </ol>
      )}
    </section>
  );
}

function PatientNotFound() {
  return (
    <EmptyState
      title="Paciente no encontrado"
      description="La ficha solicitada no existe o se ha reiniciado la demo."
      action={
        <Link to="/patients" className="btn btn-primary btn-sm">
          Volver a pacientes
        </Link>
      }
    />
  );
}

function RecordFooterLink({ patientId }: { patientId: string }) {
  return (
    <div className="flex justify-end">
      <Link
        to={`/specialists?patient_id=${patientId}`}
        className="btn btn-secondary btn-sm gap-1.5"
      >
        Buscar especialista para este paciente
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
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

  const alerts = sortAlerts(query.data.alerts ?? query.data.record?.alerts ?? []);
  const encounters = sortEncounters(query.data.record?.encounters);

  return (
    <div className="space-y-6">
      <BackLink to="/patients">Pacientes</BackLink>
      <RecordHeaderCard data={query.data} />
      <PatientReviewBanner patientId={id ?? ''} review={query.data.record?.review ?? null} />
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <RecordAlertsSection alerts={alerts} />
        <RecordEncountersSection encounters={encounters} />
      </div>
      <RecordFooterLink patientId={id ?? ''} />
    </div>
  );
}

export default PatientRecord;
