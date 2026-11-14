import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
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
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { usePatientRecord } from '../api/hooks';
import type { CanonicalPatient, Encounter, PatientSummary } from '../api/types';
import {
  ageFromBirthDate,
  formatDate,
  formatWeight,
} from '../lib/format';

type AnyPatient = CanonicalPatient | PatientSummary;

const SEX_LABELS: Record<string, string> = {
  MALE: 'Macho',
  FEMALE: 'Hembra',
  M: 'Macho',
  F: 'Hembra',
};

function patientValue(patient: AnyPatient, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = (patient as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

export function PatientRecord() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = usePatientRecord(id);

  if (isLoading) return <Loading label="Cargando la ficha canónica…" />;

  if (isError) {
    return (
      <ErrorState
        error={error}
        title="No se pudo cargar la ficha del paciente"
        onRetry={() => refetch()}
        hint="El registro canónico se genera al importar la historia"
      />
    );
  }

  const patient = data?.patient;
  if (!patient) {
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

  const record = data?.record ?? null;
  const alerts = sortAlerts(data?.alerts ?? record?.alerts ?? []);
  const encounters: Encounter[] = [...(record?.encounters ?? [])].sort((a, b) =>
    String(b.date ?? '').localeCompare(String(a.date ?? '')),
  );

  const species = patientValue(patient, 'species', 'species_label') ?? 'Especie sin definir';
  const breed = patientValue(patient, 'breed', 'breed_label') ?? 'Raza sin definir';
  const sex = patientValue(patient, 'sex');
  const microchip = patientValue(patient, 'microchip') ?? '—';
  const owner = patientValue(patient, 'owner_display') ?? 'Tutor no registrado';
  const status = patientValue(patient, 'status');
  const bcs = patientValue(patient, 'bcs');
  const weight = formatWeight(
    (patient as { weight_current_kg?: number | null }).weight_current_kg,
  );
  const age = ageFromBirthDate((patient as { birth_date?: string | null }).birth_date);

  const provenance =
    data?.provenance_summary ?? record?.provenance_summary ?? null;

  const criticalCount = alerts.filter((alert) =>
    ['CRITICAL', 'HIGH'].includes(String(alert.severity).toUpperCase()),
  ).length;

  return (
    <div className="space-y-6">
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/55 hover:text-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Pacientes
      </Link>

      {/* Cabecera de la ficha */}
      <header className="vl-card overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-content">
            {String((patient as { name?: string }).name ?? 'VL').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {(patient as { name?: string }).name ?? 'Paciente'}
              </h1>
              {status ? (
                <span className="badge badge-sm badge-ghost uppercase">{status}</span>
              ) : null}
              {criticalCount > 0 ? (
                <span className="badge badge-error badge-sm font-semibold">
                  {criticalCount} {criticalCount === 1 ? 'alerta prioritaria' : 'alertas prioritarias'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/60">
              <PawPrint className="h-4 w-4 text-secondary" aria-hidden="true" />
              <span>{species}</span>
              <span className="text-base-content/30">·</span>
              <span>{breed}</span>
              {sex ? (
                <>
                  <span className="text-base-content/30">·</span>
                  <span>{SEX_LABELS[String(sex).toUpperCase()] ?? sex}</span>
                </>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ProvenanceBadge summary={provenance} alerts={alerts.length} />
              <span className="text-[11px] text-base-content/45">
                {alerts.length} alertas · {encounters.length} encuentros
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={`/specialists?patient_id=${id ?? ''}`} className="btn btn-outline btn-sm gap-1.5">
              <Stethoscope className="h-4 w-4" />
              Buscar especialista
            </Link>
            <Link
              to={`/requests/new?patient_id=${id ?? ''}`}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Send className="h-4 w-4" />
              Nueva solicitud
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-base-300/70 bg-base-300/50 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Edad', value: age, icon: CalendarClock },
            { label: 'Peso', value: weight, icon: PawPrint },
            { label: 'BCS', value: bcs ? `${bcs} / 9` : '—', icon: ClipboardList },
            { label: 'Microchip', value: microchip, icon: IdCard },
            {
              label: 'Nacimiento',
              value: formatDate((patient as { birth_date?: string }).birth_date),
              icon: CalendarClock,
            },
            { label: 'Tutor', value: owner, icon: UserRound },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-base-100 px-4 py-3">
                <dt className="vl-label flex items-center gap-1.5">
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {item.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold" title={item.value}>
                  {item.value}
                </dd>
              </div>
            );
          })}
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Alertas */}
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

        {/* Timeline de encuentros */}
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
              {encounters.map((encounter, index) => {
                const clinic =
                  typeof encounter.clinic === 'string'
                    ? encounter.clinic
                    : encounter.clinic?.name ?? null;
                return (
                  <li key={encounter.id ?? `${encounter.date}-${index}`} className="flex gap-3 p-4">
                    <div className="flex flex-col items-center pt-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-secondary ring-4 ring-secondary/15" />
                      <span className="mt-1 w-px flex-1 bg-base-300" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
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
                      <p className="mt-0.5 text-[13px] leading-snug text-base-content/75">
                        {encounter.reason ?? 'Visita sin motivo registrado'}
                      </p>
                      {encounter.diagnosis_summary ? (
                        <p className="mt-1 rounded-lg bg-base-200/70 px-2 py-1 text-[12px] text-base-content/60">
                          <span className="font-semibold text-base-content/70">Diagnóstico: </span>
                          {encounter.diagnosis_summary}
                        </p>
                      ) : null}
                      {(clinic || encounter.clinician_ref) && (
                        <p className="mt-1 truncate text-[11px] text-base-content/40">
                          {[clinic, encounter.clinician_ref].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <Link
          to={`/specialists?patient_id=${id ?? ''}`}
          className="btn btn-secondary btn-sm gap-1.5"
        >
          Buscar especialista para este paciente
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default PatientRecord;
