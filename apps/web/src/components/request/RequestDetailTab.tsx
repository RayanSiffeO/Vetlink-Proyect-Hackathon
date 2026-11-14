import { ShieldCheck, UserRound } from 'lucide-react';
import { AlertCountChips } from '../AlertCountChips';
import { DataGapsNote } from '../DataGapsNote';
import { Spinner } from '../Spinner';
import type {
  PublicAlertRef,
  PublicPatient,
  PublicSummary,
  PriorityAction,
  RequestDetailResponse,
  RequestPatientSummary,
  RequestRecord,
} from '../../api/types';
import type { useRequestSummary } from '../../api/hooks';
import { severityStyle, shareLevelHint, shareLevelLabel } from '../../lib/format';

function PublicPatientGrid({ patient }: { patient: PublicPatient | null | undefined }) {
  if (!patient) return null;
  const items = [
    { label: 'Especie', value: patient.species ?? 'no consta' },
    { label: 'Raza', value: patient.breed ?? 'no consta' },
    { label: 'Edad', value: patient.age ?? 'no consta' },
    { label: 'Sexo', value: patient.sex ?? 'no consta' },
    {
      label: 'Peso',
      value: patient.weight_kg != null ? `${patient.weight_kg} kg` : 'no consta',
    },
    { label: 'BCS', value: patient.bcs != null ? `${patient.bcs} / 9` : 'no consta' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-base-300/70 bg-base-300/50 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-base-100 px-3 py-2">
          <dt className="vl-label">{item.label}</dt>
          <dd className="truncate text-sm font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PatientSummaryHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300/70 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserRound className="h-4 w-4 text-secondary" />
        Datos del paciente
      </h2>
      <span className="badge badge-ghost badge-sm gap-1">
        <ShieldCheck className="h-3 w-3" />
        sin datos del tutor
      </span>
    </div>
  );
}

function PatientSummaryName({ summary }: { summary: RequestPatientSummary }) {
  return (
    <p className="text-base font-semibold">
      {summary.name}
      {summary.patient?.age ? (
        <span className="ml-2 text-[12px] font-normal text-base-content/50">
          {summary.patient.age}
        </span>
      ) : null}
    </p>
  );
}

function ChronicConditions({ conditions }: { conditions: string[] }) {
  if (conditions.length === 0) return null;
  return (
    <div>
      <p className="vl-label">Antecedentes activos</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {conditions.map((condition) => (
          <span key={condition} className="badge badge-sm badge-outline">
            {condition}
          </span>
        ))}
      </div>
    </div>
  );
}

function PatientSummaryCard({ summary }: { summary: RequestPatientSummary | null | undefined }) {
  if (!summary) return null;
  return (
    <section className="vl-card overflow-hidden">
      <PatientSummaryHeader />
      <div className="space-y-3 p-4">
        <PatientSummaryName summary={summary} />
        <PublicPatientGrid patient={summary.patient} />
        {summary.headline ? (
          <p className="rounded-xl bg-base-200/70 px-3 py-2 text-[12px] leading-snug text-base-content/65">
            {summary.headline}
          </p>
        ) : null}
        <AlertCountChips counts={summary.alert_counts} />
        <ChronicConditions conditions={summary.patient?.chronic_conditions ?? []} />
      </div>
    </section>
  );
}

function SharedAlertRow({ alert }: { alert: PublicAlertRef }) {
  const style = severityStyle(alert.severity);
  return (
    <li className="flex items-start gap-2 text-[12px]">
      <span className={`badge badge-xs mt-0.5 shrink-0 ${style.badge}`}>{style.label}</span>
      <span className="text-base-content/70">{alert.title}</span>
    </li>
  );
}

function SharedAlerts({ alerts }: { alerts?: PublicAlertRef[] | null }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div>
      <p className="vl-label">Alertas compartidas</p>
      <ul className="mt-1 space-y-1">
        {alerts.map((alert, index) => (
          <SharedAlertRow key={index} alert={alert} />
        ))}
      </ul>
    </div>
  );
}

function SummaryPriorityActions({ actions }: { actions?: PriorityAction[] | null }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div>
      <p className="vl-label">Acciones prioritarias</p>
      <ol className="mt-1 space-y-1">
        {actions.slice(0, 4).map((action, index) => (
          <li key={index} className="text-[12px] leading-snug text-base-content/70">
            <span className="font-semibold">{action.title}</span>
            {action.action ? ` — ${action.action}` : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PrivacyNote({ privacy }: { privacy: NonNullable<PublicSummary['privacy']> }) {
  const excluded =
    privacy.excluded && privacy.excluded.length > 0
      ? ` Excluye: ${privacy.excluded.join(', ')}.`
      : '';
  return (
    <p className="rounded-xl bg-base-200/60 px-3 py-2 text-[11px] leading-snug text-base-content/50">
      {privacy.note}
      {excluded}
    </p>
  );
}

function PublicSummaryBody({ summary }: { summary: PublicSummary }) {
  return (
    <>
      {summary.headline ? (
        <p className="text-[13px] font-medium leading-snug text-base-content/75">
          {summary.headline}
        </p>
      ) : null}
      <PublicPatientGrid patient={summary.patient} />
      <AlertCountChips counts={summary.alert_counts} />
      <SharedAlerts alerts={summary.alerts} />
      <SummaryPriorityActions actions={summary.priority_actions} />
      {summary.data_gaps && summary.data_gaps.length > 0 ? (
        <DataGapsNote
          gaps={summary.data_gaps}
          className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-[11px] leading-snug text-base-content/60"
        />
      ) : null}
      {summary.privacy ? <PrivacyNote privacy={summary.privacy} /> : null}
    </>
  );
}

function SummaryBody({ query }: { query: ReturnType<typeof useRequestSummary> }) {
  if (query.isError) {
    return (
      <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
        {query.error.message}
      </p>
    );
  }
  if (!query.data) {
    return <p className="mt-3 text-[12px] text-base-content/45">Cargando resumen…</p>;
  }
  return (
    <div className="mt-3 space-y-3">
      <PublicSummaryBody summary={query.data} />
    </div>
  );
}

function SummaryPanel({
  request,
  summaryQuery,
}: {
  request: RequestRecord;
  summaryQuery: ReturnType<typeof useRequestSummary>;
}) {
  return (
    <section className="vl-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Resumen no identificativo</h2>
        {summaryQuery.isFetching ? <Spinner size="xs" /> : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-base-content/45">
        Lo que el especialista ve antes de aceptar: clínico, sin datos del tutor.
      </p>
      <SummaryBody query={summaryQuery} />
      <p className="mt-3 rounded-xl border border-base-300/70 px-3 py-2 text-[11px] leading-snug text-base-content/50">
        Nivel de esta solicitud: {shareLevelLabel(request.share_level)}.{' '}
        {shareLevelHint(request.share_level)}
      </p>
    </section>
  );
}

export function DetailTab({
  data,
  summaryQuery,
}: {
  data: RequestDetailResponse;
  summaryQuery: ReturnType<typeof useRequestSummary>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <PatientSummaryCard summary={data.patient_summary} />
      <SummaryPanel request={data.request} summaryQuery={summaryQuery} />
    </div>
  );
}
