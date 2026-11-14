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
import { lookupValue } from '../../lib/lookup';
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
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line/70 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white/70 px-3 py-2">
          <dt className="vl-label">{item.label}</dt>
          <dd className="truncate text-[13px] font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PatientSummaryHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <h2 className="flex items-center gap-2 text-[14px] font-medium leading-5 text-ink">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        Datos del paciente
      </h2>
      <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-white/70 px-2 py-0.5 text-[10.5px] font-medium leading-4 text-caption">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        sin datos del tutor
      </span>
    </div>
  );
}

function PatientSummaryName({ summary }: { summary: RequestPatientSummary }) {
  return (
    <p className="text-[16px] font-medium leading-6 text-ink">
      {summary.name}
      {summary.patient?.age ? (
        <span className="ml-2 text-[12px] font-normal text-caption">{summary.patient.age}</span>
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
          <span
            key={condition}
            className="rounded-full border border-line-strong bg-white/70 px-2.5 py-0.5 text-[10.5px] leading-4 text-para"
          >
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
    <section className="overflow-hidden rounded-card border border-line bg-white/70 shadow-soft">
      <PatientSummaryHeader />
      <div className="space-y-3 p-4">
        <PatientSummaryName summary={summary} />
        <PublicPatientGrid patient={summary.patient} />
        {summary.headline ? (
          <p className="rounded-xl bg-mist/80 px-3 py-2 text-[12px] leading-[18px] text-para">
            {summary.headline}
          </p>
        ) : null}
        <AlertCountChips counts={summary.alert_counts} />
        <ChronicConditions conditions={summary.patient?.chronic_conditions ?? []} />
      </div>
    </section>
  );
}

const SHARED_ALERT_TONES: Record<string, string> = {
  CRITICAL: 'text-crit',
  HIGH: 'text-warn',
  MEDIUM: 'text-infoblue',
};

const FALLBACK_ALERT_TONE = 'text-caption';

function SharedAlertRow({ alert }: { alert: PublicAlertRef }) {
  const style = severityStyle(alert.severity);
  const tone = lookupValue(
    SHARED_ALERT_TONES,
    String(alert.severity ?? '').toUpperCase(),
    FALLBACK_ALERT_TONE,
  );
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-line/60 bg-white/55 px-2.5 py-2 text-[12px] leading-[18px]">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${tone}`} aria-hidden="true" />
      <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] ${tone}`}>
        {style.label}
      </span>
      <span className="min-w-0 text-para">{alert.title}</span>
    </li>
  );
}

function SharedAlerts({ alerts }: { alerts?: PublicAlertRef[] | null }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div>
      <p className="vl-label">Alertas compartidas</p>
      <ul className="mt-1.5 space-y-1.5">
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
      <ol className="mt-1.5 space-y-1.5">
        {actions.slice(0, 4).map((action, index) => (
          <li key={index} className="text-[12px] leading-[18px] text-para">
            <span className="font-medium text-ink">{action.title}</span>
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
    <p className="rounded-xl border border-line bg-white/55 px-3 py-2 text-[11px] leading-[17px] text-caption">
      {privacy.note}
      {excluded}
    </p>
  );
}

function PublicSummaryBody({ summary }: { summary: PublicSummary }) {
  return (
    <>
      {summary.headline ? (
        <p className="text-[13px] font-medium leading-[19px] text-para">{summary.headline}</p>
      ) : null}
      <PublicPatientGrid patient={summary.patient} />
      <AlertCountChips counts={summary.alert_counts} />
      <SharedAlerts alerts={summary.alerts} />
      <SummaryPriorityActions actions={summary.priority_actions} />
      {summary.data_gaps && summary.data_gaps.length > 0 ? (
        <DataGapsNote
          gaps={summary.data_gaps}
          className="rounded-xl border border-warn/20 bg-warn-soft/70 px-2.5 py-1.5 text-[11px] leading-snug text-para"
        />
      ) : null}
      {summary.privacy ? <PrivacyNote privacy={summary.privacy} /> : null}
    </>
  );
}

function SummaryBody({ query }: { query: ReturnType<typeof useRequestSummary> }) {
  if (query.isError) {
    return (
      <p className="mt-3 rounded-xl border border-crit/20 bg-crit-soft px-3 py-2 text-[12px] text-crit">
        {query.error.message}
      </p>
    );
  }
  if (!query.data) {
    return <p className="mt-3 text-[12px] text-caption">Cargando resumen…</p>;
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
    <section className="rounded-card border border-line bg-white/70 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-medium leading-5 text-ink">Resumen no identificativo</h2>
        {summaryQuery.isFetching ? <Spinner size="xs" /> : null}
      </div>
      <p className="mt-1 text-[11px] leading-[17px] text-caption">
        Lo que el especialista ve antes de aceptar: clínico, sin datos del tutor.
      </p>
      <SummaryBody query={summaryQuery} />
      <p className="mt-3 rounded-xl border border-line bg-white/55 px-3 py-2 text-[11px] leading-[17px] text-caption">
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
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <PatientSummaryCard summary={data.patient_summary} />
      <SummaryPanel request={data.request} summaryQuery={summaryQuery} />
    </div>
  );
}
