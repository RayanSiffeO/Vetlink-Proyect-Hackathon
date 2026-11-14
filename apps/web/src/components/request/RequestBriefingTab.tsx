import type { ReactNode } from 'react';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import AlertCard, { sortAlerts } from '../AlertCard';
import { AlertCountChips } from '../AlertCountChips';
import { DataGapsNote } from '../DataGapsNote';
import { ErrorState } from '../EmptyState';
import { Loading } from '../Loading';
import { ApiError } from '../../api/client';
import { useBriefing, useIsSpecialist } from '../../api/hooks';
import type {
  AlertItem,
  BriefingBody,
  PriorityAction,
  BriefingResponse,
  RecordMeta,
  RequestDetailResponse,
} from '../../api/types';
import { formatDateTime, relativeTime, severityStyle } from '../../lib/format';

function briefingLocked(error: unknown): boolean {
  return error instanceof ApiError && error.isForbidden;
}

function BriefingLocked({ onShowDetail, hint }: { onShowDetail: () => void; hint: ReactNode }) {
  return (
    <div className="vl-card border-warning/40 bg-warning/5 p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/15 text-warning">
        <Lock className="h-6 w-6" />
      </div>
      <h2 className="mt-3 text-base font-semibold">Briefing bloqueado</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-base-content/60">
        La historia completa y el briefing se abren cuando la solicitud está aceptada. Antes de
        aceptar solo se comparte el resumen clínico no identificativo (minimización RGPD).
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={onShowDetail}>
          Ver resumen disponible
        </button>
        {hint}
      </div>
    </div>
  );
}

function BriefingStatus({
  query,
  onShowDetail,
  hint,
}: {
  query: ReturnType<typeof useBriefing>;
  onShowDetail: () => void;
  hint: ReactNode;
}) {
  if (query.isLoading) return <Loading label="Generando el briefing…" />;
  if (!query.isError) return null;
  if (briefingLocked(query.error)) return <BriefingLocked onShowDetail={onShowDetail} hint={hint} />;
  return (
    <ErrorState
      error={query.error}
      title="No se pudo generar el briefing"
      onRetry={() => query.refetch()}
    />
  );
}

function BriefingTitle({
  briefing,
  patientName,
}: {
  briefing: BriefingBody;
  patientName: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="vl-section-title">VetBriefing · pre-visita</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {briefing.patient_label ?? patientName ?? 'Briefing'}
      </h2>
      {briefing.headline ? (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-base-content/65">
          {briefing.headline}
        </p>
      ) : null}
    </div>
  );
}

function BriefingBadges({
  briefing,
  unlockedAt,
}: {
  briefing: BriefingBody;
  unlockedAt?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {unlockedAt ? (
        <span className="badge badge-sm badge-ghost">desbloqueado {relativeTime(unlockedAt)}</span>
      ) : null}
      {briefing.data_freshness_days != null ? (
        <span className="badge badge-sm badge-outline">
          datos de hace {briefing.data_freshness_days} días
        </span>
      ) : null}
    </div>
  );
}

function BriefingOverview({
  briefing,
  patientName,
  unlockedAt,
}: {
  briefing: BriefingBody;
  patientName: string | null;
  unlockedAt?: string | null;
}) {
  return (
    <div className="vl-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <BriefingTitle briefing={briefing} patientName={patientName} />
        <BriefingBadges briefing={briefing} unlockedAt={unlockedAt} />
      </div>
      <div className="mt-3">
        <AlertCountChips counts={briefing.alert_counts} />
      </div>
      {briefing.data_gaps && briefing.data_gaps.length > 0 ? (
        <DataGapsNote
          gaps={briefing.data_gaps}
          className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-base-content/60"
        />
      ) : null}
    </div>
  );
}

function BriefingActionItem({ action }: { action: PriorityAction }) {
  const style = severityStyle(action.severity);
  return (
    <li className="flex items-start gap-2">
      <span className={`badge badge-sm mt-0.5 shrink-0 ${style.badge}`}>{style.label}</span>
      <span className="text-sm leading-snug text-base-content/75">
        <span className="font-semibold">{action.title}</span>
        {action.action ? (
          <span className="block text-[12px] text-base-content/55">{action.action}</span>
        ) : null}
      </span>
    </li>
  );
}

function BriefingPriorityActions({ actions }: { actions?: PriorityAction[] | null }) {
  return (
    <div className="vl-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Acciones prioritarias
      </h3>
      {actions && actions.length > 0 ? (
        <ol className="mt-2 space-y-2">
          {actions.map((action, index) => (
            <BriefingActionItem key={index} action={action} />
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-[13px] text-base-content/50">
          Sin acciones marcadas por las reglas.
        </p>
      )}
    </div>
  );
}

function BriefingAlerts({ alerts, total }: { alerts?: AlertItem[] | null; total?: number | null }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-semibold">Alertas del registro ({total ?? '—'})</h3>
      {sortAlerts(alerts).map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function RecordMetaBar({ meta }: { meta: RecordMeta }) {
  return (
    <div className="vl-card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-[11px] text-base-content/50">
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
        registro v{meta.record_version ?? '—'} · {meta.source_system ?? 'origen desconocido'}
      </span>
      <span>importado {formatDateTime(meta.imported_at)}</span>
      <span>{meta.alerts_count ?? 0} alertas</span>
    </div>
  );
}

function BriefingJson({ briefing }: { briefing: BriefingBody }) {
  return (
    <details className="vl-card p-4">
      <summary className="cursor-pointer text-[12px] font-medium text-base-content/55">
        Ver briefing completo (JSON)
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-base-200/70 p-3 font-mono text-[11px] leading-relaxed text-base-content/70">
        {JSON.stringify(briefing, null, 2)}
      </pre>
    </details>
  );
}

function BriefingContent({
  briefing,
  data,
  result,
}: {
  briefing: BriefingBody | null;
  data: RequestDetailResponse;
  result: BriefingResponse | undefined;
}) {
  if (!briefing) return null;
  const meta = result?.record_meta ?? null;
  const patientName = data.patient_summary?.name ?? null;
  return (
    <>
      <BriefingOverview
        briefing={briefing}
        patientName={patientName}
        unlockedAt={result?.unlocked_at}
      />
      <BriefingPriorityActions actions={briefing.priority_actions} />
      <BriefingAlerts alerts={briefing.alerts_rendered} total={briefing.alerts_total} />
      {meta ? <RecordMetaBar meta={meta} /> : null}
      <BriefingJson briefing={briefing} />
    </>
  );
}

export function BriefingTab({
  id,
  data,
  onShowDetail,
}: {
  id: string;
  data: RequestDetailResponse;
  onShowDetail: () => void;
}) {
  const query = useBriefing(id);
  const specialistRole = useIsSpecialist();
  const status = String(data.request.status ?? '').toUpperCase();
  const briefing = query.data?.briefing ?? null;
  const hint =
    specialistRole && status === 'REQUESTED' ? (
      <span className="badge badge-warning gap-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        Acepta la solicitud para desbloquearlo
      </span>
    ) : null;

  return (
    <section className="space-y-3">
      <BriefingStatus query={query} onShowDetail={onShowDetail} hint={hint} />
      <BriefingContent briefing={briefing} data={data} result={query.data} />
    </section>
  );
}
