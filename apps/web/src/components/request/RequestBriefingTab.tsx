import type { ReactNode } from 'react';
import { AlertTriangle, Clock3, Lock, ShieldCheck } from 'lucide-react';
import AlertCard, { sortAlerts } from '../AlertCard';
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
  Encounter,
  RecordMeta,
  RequestDetailResponse,
} from '../../api/types';
import { formatDate, formatDateTime, relativeTime, severityStyle } from '../../lib/format';
import { lookupValue } from '../../lib/lookup';
import { sortEncounters } from '../../lib/patients';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_TILES: Record<string, string> = {
  CRITICAL: 'border-white/60 bg-white/35 text-crit',
  HIGH: 'border-white/60 bg-white/35 text-warn',
  MEDIUM: 'border-white/60 bg-white/35 text-infoblue',
  LOW: 'border-white/60 bg-white/35 text-caption',
  INFO: 'border-white/60 bg-white/35 text-caption',
};

const FALLBACK_TILE = 'border-white/60 bg-white/35 text-caption';

const ACTION_SURFACES: Record<string, string> = {
  CRITICAL: 'border-line/70 bg-white/75',
  HIGH: 'border-line/70 bg-white/75',
  MEDIUM: 'border-line/70 bg-white/75',
};

const ACTION_CHIPS: Record<string, string> = {
  CRITICAL: 'border-crit/15 bg-white/60 text-crit',
  HIGH: 'border-warn/15 bg-white/60 text-warn',
  MEDIUM: 'border-infoblue/15 bg-white/60 text-infoblue',
};

const FALLBACK_ACTION_SURFACE = 'border-line/70 bg-white/75';
const FALLBACK_ACTION_CHIP = 'border-line-strong bg-white/60 text-caption';

function briefingLocked(error: unknown): boolean {
  return error instanceof ApiError && error.isForbidden;
}

function BriefingLocked({ onShowDetail, hint }: { onShowDetail: () => void; hint: ReactNode }) {
  return (
    <div className="glass-strong rounded-panel p-6 text-center sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warn-soft text-warn ring-1 ring-inset ring-warn/15">
        <Lock className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-[22px] font-medium leading-7 tracking-[-0.02em] text-ink">
        Briefing bloqueado
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[19px] text-para">
        La historia completa y el briefing se abren cuando la solicitud está aceptada. Antes de
        aceptar solo se comparte el resumen clínico no identificativo (minimización RGPD).
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white/70 px-4 py-2 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700"
          onClick={onShowDetail}
        >
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
      <p className="vl-section-title text-indigo-700">VetBriefing · pre-visita</p>
      <h2 className="mt-2 break-words text-[30px] font-medium leading-[36px] tracking-[-0.03em] text-ink sm:text-[38px] sm:leading-[44px]">
        {briefing.patient_label ?? patientName ?? 'Briefing'}
      </h2>
      {briefing.headline ? (
        <p className="mt-2 max-w-2xl break-words text-[13px] leading-[19px] text-para">
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
        <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-white/70 px-2.5 py-1 text-[10.5px] font-medium leading-4 text-caption">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          desbloqueado {relativeTime(unlockedAt)}
        </span>
      ) : null}
      {briefing.data_freshness_days != null ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10.5px] font-medium leading-4 text-indigo-700">
          datos de hace {briefing.data_freshness_days} días
        </span>
      ) : null}
    </div>
  );
}

function SeverityTiles({ counts }: { counts?: Record<string, number> | null }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {SEVERITIES.map((severity) => {
        const style = severityStyle(severity);
        const tone = lookupValue(SEVERITY_TILES, severity, FALLBACK_TILE);
        const count = Number(counts?.[severity] ?? 0);
        return (
          <div
            key={severity}
            className={`rounded-2xl border px-1.5 py-2 text-center sm:px-3 sm:py-3 ${tone}`}
          >
            <p className="text-[22px] font-medium leading-none tracking-[-0.03em] sm:text-[26px]">
              {count}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase leading-3 tracking-[0.08em] sm:text-[10px]">
              {style.label}
            </p>
          </div>
        );
      })}
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
    <div className="glass-strong rounded-panel p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-center">
        <div className="min-w-0">
          <BriefingTitle briefing={briefing} patientName={patientName} />
          <div className="mt-3">
            <BriefingBadges briefing={briefing} unlockedAt={unlockedAt} />
          </div>
        </div>
        <SeverityTiles counts={briefing.alert_counts} />
      </div>
      {briefing.data_gaps && briefing.data_gaps.length > 0 ? (
        <DataGapsNote
          gaps={briefing.data_gaps}
          className="mt-4 rounded-2xl border border-warn/20 bg-warn-soft/70 px-3.5 py-2.5 text-[11.5px] leading-[17px] text-para"
        />
      ) : null}
    </div>
  );
}

function PriorityActionCard({ action, index }: { action: PriorityAction; index: number }) {
  const style = severityStyle(action.severity);
  const surface = lookupValue(
    ACTION_SURFACES,
    String(action.severity ?? '').toUpperCase(),
    FALLBACK_ACTION_SURFACE,
  );
  const chip = lookupValue(
    ACTION_CHIPS,
    String(action.severity ?? '').toUpperCase(),
    FALLBACK_ACTION_CHIP,
  );
  return (
    <li
      className={`relative flex flex-col rounded-card border p-4 shadow-soft transition duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-card ${surface}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em] leading-3 ${chip}`}
        >
          {style.label}
        </span>
        <span className="text-[22px] font-medium leading-none tracking-[-0.04em] text-caption/30">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <p className="mt-2.5 text-[14px] font-medium leading-5 text-ink">{action.title}</p>
      {action.action ? (
        <p className="mt-1 text-[12px] leading-[18px] text-para">{action.action}</p>
      ) : null}
    </li>
  );
}

function BriefingPriorityActions({ actions }: { actions?: PriorityAction[] | null }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-medium leading-6 text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-warn-soft text-warn">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Acciones prioritarias
        </h3>
        {actions && actions.length > 0 ? (
          <span className="text-[11px] leading-4 text-caption">{actions.length} acciones</span>
        ) : null}
      </div>
      {actions && actions.length > 0 ? (
        <ol className="stagger grid gap-3 sm:grid-cols-3">
          {actions.map((action, index) => (
            <PriorityActionCard key={index} action={action} index={index} />
          ))}
        </ol>
      ) : (
        <p className="glass rounded-2xl px-4 py-3 text-[13px] leading-5 text-caption">
          Sin acciones marcadas por las reglas.
        </p>
      )}
    </section>
  );
}

function BriefingAlerts({ alerts, total }: { alerts?: AlertItem[] | null; total?: number | null }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="space-y-2.5">
      <h3 className="text-[15px] font-medium leading-6 text-ink">
        Alertas del registro ({total ?? '—'})
      </h3>
      <div className="space-y-2.5">
        {sortAlerts(alerts).map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}

function BriefingTimelineRow({ encounter }: { encounter: Encounter }) {
  return (
    <li className="flex min-w-0 gap-2.5 py-2">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo ring-4 ring-indigo-50" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] leading-4 text-indigo-700">
            {formatDate(encounter.date)}
          </span>
          {encounter.type ? (
            <span className="text-[9.5px] font-medium uppercase tracking-[0.08em] leading-3 text-caption">
              {String(encounter.type).replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>
        <p className="break-words text-[12.5px] font-medium leading-[18px] text-ink">
          {encounter.reason ?? 'Visita sin motivo registrado'}
        </p>
      </div>
    </li>
  );
}

function BriefingTimeline({ encounters }: { encounters: Encounter[] }) {
  if (encounters.length === 0) return null;
  const recent = sortEncounters(encounters).slice(0, 4);
  return (
    <section className="glass rounded-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium leading-5 text-ink">Cronología</h3>
        <span className="text-[11px] leading-4 text-caption">{encounters.length} encuentros</span>
      </div>
      <ol className="mt-1.5 grid gap-x-6 sm:grid-cols-2">
        {recent.map((encounter, index) => (
          <BriefingTimelineRow key={encounter.id ?? `${encounter.date}-${index}`} encounter={encounter} />
        ))}
      </ol>
    </section>
  );
}

function RecordMetaBar({ meta }: { meta: RecordMeta }) {
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-2.5 text-[11px] leading-4 text-caption">
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />
        registro v{meta.record_version ?? '—'} · {meta.source_system ?? 'origen desconocido'}
      </span>
      <span>importado {formatDateTime(meta.imported_at)}</span>
      <span>{meta.alerts_count ?? 0} alertas</span>
    </div>
  );
}

function BriefingJson({ briefing }: { briefing: BriefingBody }) {
  return (
    <details className="glass rounded-card p-4">
      <summary className="cursor-pointer text-[12px] font-medium text-caption hover:text-indigo-700">
        Ver briefing completo (JSON)
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white/60 p-3 font-mono text-[11px] leading-relaxed text-para">
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
  const encounters = result?.record?.encounters ?? [];
  return (
    <div className="space-y-4">
      <BriefingOverview
        briefing={briefing}
        patientName={patientName}
        unlockedAt={result?.unlocked_at}
      />
      <BriefingPriorityActions actions={briefing.priority_actions} />
      <BriefingTimeline encounters={encounters} />
      {meta ? <RecordMetaBar meta={meta} /> : null}
      <BriefingAlerts alerts={briefing.alerts_rendered} total={briefing.alerts_total} />
      <BriefingJson briefing={briefing} />
    </div>
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
      <span className="inline-flex items-center gap-1 rounded-full border border-warn/20 bg-warn-soft px-2.5 py-1 text-[10.5px] font-medium leading-4 text-warn">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Acepta la solicitud para desbloquearlo
      </span>
    ) : null;

  return (
    <section className="space-y-4">
      <BriefingStatus query={query} onShowDetail={onShowDetail} hint={hint} />
      <BriefingContent briefing={briefing} data={data} result={query.data} />
    </section>
  );
}
