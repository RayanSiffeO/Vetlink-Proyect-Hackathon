import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Lock,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  XCircle,
} from 'lucide-react';
import AlertCard, { sortAlerts } from '../components/AlertCard';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { ApiError } from '../api/client';
import {
  useAcceptRequest,
  useAppointments,
  useBriefing,
  useCancelRequest,
  useDeclineRequest,
  useMe,
  useRequest,
  useRequestAudit,
  useRequestSummary,
  useSpecialist,
} from '../api/hooks';
import type {
  PublicPatient,
  RequestPatientSummary,
} from '../api/types';
import {
  formatDateTime,
  isSpecialist,
  isUnlockedStatus,
  relativeTime,
  requestStatusStyle,
  severityStyle,
  shareLevelHint,
  shareLevelLabel,
  slotIso,
  slotLabel,
  urgencyBadge,
  urgencyLabel,
} from '../lib/format';

type Tab = 'detail' | 'briefing' | 'audit';

const TABS: Array<{ id: Tab; label: string; icon: typeof ClipboardList }> = [
  { id: 'detail', label: 'Detalle', icon: ClipboardList },
  { id: 'briefing', label: 'Briefing', icon: Sparkles },
  { id: 'audit', label: 'Auditoría', icon: ScrollText },
];

function toIsoFromLocal(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function AlertCountChips({ counts }: { counts: Record<string, number> | null | undefined }) {
  if (!counts) return null;
  const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([severity, count]) => {
        const style = severityStyle(severity);
        return (
          <span key={severity} className={`badge badge-sm ${style.badge}`}>
            {count} {style.label.toLowerCase()}
          </span>
        );
      })}
    </div>
  );
}

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

function PatientSummaryCard({ summary }: { summary: RequestPatientSummary | null | undefined }) {
  if (!summary) return null;
  const chronic = summary.patient?.chronic_conditions ?? [];
  return (
    <section className="vl-card overflow-hidden">
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
      <div className="space-y-3 p-4">
        <p className="text-base font-semibold">
          {summary.name}
          {summary.patient?.age ? (
            <span className="ml-2 text-[12px] font-normal text-base-content/50">
              {summary.patient.age}
            </span>
          ) : null}
        </p>
        <PublicPatientGrid patient={summary.patient} />
        {summary.headline ? (
          <p className="rounded-xl bg-base-200/70 px-3 py-2 text-[12px] leading-snug text-base-content/65">
            {summary.headline}
          </p>
        ) : null}
        <AlertCountChips counts={summary.alert_counts} />
        {chronic.length > 0 ? (
          <div>
            <p className="vl-label">Antecedentes activos</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {chronic.map((condition) => (
                <span key={condition} className="badge badge-sm badge-outline">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useMe();
  const requestQuery = useRequest(id);
  const summaryQuery = useRequestSummary(id);
  const auditQuery = useRequestAudit(id);

  const tabParam = searchParams.get('tab');
  const tab: Tab =
    tabParam === 'briefing' || tabParam === 'audit' ? (tabParam as Tab) : 'detail';

  const request = requestQuery.data?.request;
  const status = String(request?.status ?? '').toUpperCase();
  const specialistRole = isSpecialist(user);
  const unlocked = isUnlockedStatus(status);

  const briefingQuery = useBriefing(id, tab === 'briefing');
  const slotsQuery = useSpecialist(
    specialistRole && status === 'REQUESTED' ? request?.specialist_id ?? undefined : undefined,
  );
  const appointmentsQuery = useAppointments();

  const accept = useAcceptRequest(id);
  const decline = useDeclineRequest(id);
  const cancel = useCancelRequest(id);

  const [selectedSlot, setSelectedSlot] = useState('');
  const [manualSlot, setManualSlot] = useState('');

  const slots = slotsQuery.data?.available_slots ?? [];
  const effectiveSlot = selectedSlot || toIsoFromLocal(manualSlot);

  useEffect(() => {
    if (!selectedSlot && slots.length > 0) {
      const first = slotIso(slots[0]);
      if (first) setSelectedSlot(first);
    }
  }, [slots, selectedSlot]);

  const briefingLocked = useMemo(
    () => briefingQuery.error instanceof ApiError && briefingQuery.error.isForbidden,
    [briefingQuery.error],
  );

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'detail') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  if (requestQuery.isLoading) return <Loading label="Cargando la solicitud…" />;

  if (requestQuery.isError) {
    return (
      <ErrorState
        error={requestQuery.error}
        title="No se pudo cargar la solicitud"
        onRetry={() => requestQuery.refetch()}
        hint="Puede que la demo se haya reiniciado"
      />
    );
  }

  if (!request) {
    return (
      <EmptyState
        title="Solicitud no encontrada"
        description="Comprueba el enlace o vuelve al listado de solicitudes."
        action={
          <Link to="/requests" className="btn btn-primary btn-sm">
            Ver solicitudes
          </Link>
        }
      />
    );
  }

  const statusStyle = requestStatusStyle(status);
  const patientSummary = requestQuery.data?.patient_summary ?? null;
  const specialist = requestQuery.data?.specialist ?? null;
  const summary = summaryQuery.data ?? null;
  const appointment =
    (appointmentsQuery.data?.appointments ?? []).find((item) => item.request_id === request.id) ??
    null;
  const actionError = accept.error ?? decline.error ?? cancel.error;
  const canCancel = !specialistRole && !['COMPLETED', 'CANCELLED', 'DECLINED'].includes(status);

  return (
    <div className="space-y-6">
      <Link
        to="/requests"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/55 hover:text-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Solicitudes
      </Link>

      {/* Cabecera */}
      <header className="vl-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${statusStyle.badge} font-semibold`}>{statusStyle.label}</span>
              <span className={`badge badge-sm ${urgencyBadge(request.urgencia)}`}>
                <AlertTriangle className="h-3 w-3" />
                {urgencyLabel(request.urgencia)}
              </span>
              <span className="badge badge-sm badge-outline gap-1">
                <ShieldCheck className="h-3 w-3" />
                {String(request.share_level ?? 'CLINICAL').toUpperCase()}
              </span>
              {status === 'SCHEDULED' ? (
                <span className="badge badge-sm badge-success gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {appointment ? formatDateTime(appointment.when_iso) : 'cita confirmada'}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {patientSummary?.name ? `Caso de ${patientSummary.name}` : 'Solicitud de derivación'}
            </h1>
            <p className="mt-0.5 text-[12px] text-base-content/45">
              {specialist ? `${specialist.name} · ${specialist.specialty} · ${specialist.zone}` : ''}
              {specialist && request.created_at ? ' · ' : ''}
              {request.created_at ? `creada ${relativeTime(request.created_at)}` : `id ${request.id}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {request.patient_id && !specialistRole ? (
              <Link to={`/patients/${request.patient_id}`} className="btn btn-ghost btn-sm gap-1.5">
                <ClipboardList className="h-4 w-4" />
                Ficha completa
              </Link>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm gap-1.5"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Cancelar
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-xl bg-base-200/70 p-3 text-[12px] sm:grid-cols-2">
          <p>
            <span className="vl-label block">Motivo de la derivación</span>
            {request.motivo || '—'}
          </p>
          <p>
            <span className="vl-label block">Franjas preferidas</span>
            {request.preferred ? request.preferred : 'Sin preferencia declarada'}
          </p>
        </div>
      </header>

      {actionError ? (
        <div className="alert alert-error items-start text-sm" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{actionError.message}</span>
        </div>
      ) : null}

      {/* Aceptación (especialista) */}
      {specialistRole && status === 'REQUESTED' ? (
        <section className="vl-card border-secondary/40 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-secondary" />
            Aceptar la derivación y confirmar franja
          </h2>
          <p className="mt-1 text-[12px] text-base-content/55">
            Al aceptar se desbloquean la historia completa y el briefing según el nivel
            {` ${shareLevelLabel(request.share_level)}`} y queda registrado en la auditoría.
          </p>

          {slotsQuery.isLoading ? (
            <p className="mt-3 text-[12px] text-base-content/50">Cargando disponibilidad…</p>
          ) : slots.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {slots.map((slot, index) => {
                const iso = slotIso(slot);
                return (
                  <button
                    key={iso || index}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(iso);
                      setManualSlot('');
                    }}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      selectedSlot === iso
                        ? 'border-secondary bg-secondary/10 font-semibold text-secondary'
                        : 'border-base-300 hover:border-secondary/50'
                    }`}
                  >
                    {slotLabel(slot)}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-base-content/50">
              {slotsQuery.isError
                ? `No se pudo cargar la disponibilidad (${slotsQuery.error.message}). Indica una fecha concreta.`
                : 'Sin franjas publicadas: indica una fecha concreta.'}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="vl-label">Otra franja</span>
              <input
                type="datetime-local"
                className="input input-bordered input-sm mt-1"
                value={manualSlot}
                onChange={(event) => {
                  setManualSlot(event.target.value);
                  setSelectedSlot('');
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm gap-1.5"
              disabled={!effectiveSlot || accept.isPending}
              onClick={() => accept.mutate({ slot_iso: effectiveSlot })}
            >
              {accept.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Aceptar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-1.5 text-error"
              onClick={() => decline.mutate()}
              disabled={decline.isPending}
            >
              <XCircle className="h-4 w-4" />
              Rechazar
            </button>
            <span className="text-[11px] text-base-content/45">
              {effectiveSlot ? `Franja: ${formatDateTime(effectiveSlot)}` : 'Selecciona una franja'}
            </span>
          </div>
        </section>
      ) : null}

      {specialistRole && unlocked ? (
        <div className="alert alert-success items-start text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Historia desbloqueada. El briefing pre-visita ya está disponible en la pestaña
            «Briefing».
          </span>
        </div>
      ) : null}

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed w-full max-w-md bg-base-100 p-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`tab flex-1 gap-1.5 text-[13px] ${tab === item.id ? 'tab-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'detail' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <PatientSummaryCard summary={patientSummary} />

          <section className="vl-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Resumen no identificativo</h2>
              {summaryQuery.isFetching ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-base-content/45">
              Lo que el especialista ve antes de aceptar: clínico, sin datos del tutor.
            </p>

            {summaryQuery.isError ? (
              <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
                {summaryQuery.error.message}
              </p>
            ) : summary ? (
              <div className="mt-3 space-y-3">
                {summary.headline ? (
                  <p className="text-[13px] font-medium leading-snug text-base-content/75">
                    {summary.headline}
                  </p>
                ) : null}
                <PublicPatientGrid patient={summary.patient} />
                <AlertCountChips counts={summary.alert_counts} />

                {summary.alerts && summary.alerts.length > 0 ? (
                  <div>
                    <p className="vl-label">Alertas compartidas</p>
                    <ul className="mt-1 space-y-1">
                      {summary.alerts.map((alert, index) => {
                        const style = severityStyle(alert.severity);
                        return (
                          <li key={index} className="flex items-start gap-2 text-[12px]">
                            <span className={`badge badge-xs mt-0.5 shrink-0 ${style.badge}`}>
                              {style.label}
                            </span>
                            <span className="text-base-content/70">{alert.title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {summary.priority_actions && summary.priority_actions.length > 0 ? (
                  <div>
                    <p className="vl-label">Acciones prioritarias</p>
                    <ol className="mt-1 space-y-1">
                      {summary.priority_actions.slice(0, 4).map((action, index) => (
                        <li key={index} className="text-[12px] leading-snug text-base-content/70">
                          <span className="font-semibold">{action.title}</span>
                          {action.action ? ` — ${action.action}` : ''}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {summary.data_gaps && summary.data_gaps.length > 0 ? (
                  <p className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-[11px] leading-snug text-base-content/60">
                    <span className="font-semibold">Datos que faltan: </span>
                    {summary.data_gaps.join(' · ')}
                  </p>
                ) : null}

                {summary.privacy ? (
                  <p className="rounded-xl bg-base-200/60 px-3 py-2 text-[11px] leading-snug text-base-content/50">
                    {summary.privacy.note}
                    {summary.privacy.excluded && summary.privacy.excluded.length > 0
                      ? ` Excluye: ${summary.privacy.excluded.join(', ')}.`
                      : ''}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-base-content/45">Cargando resumen…</p>
            )}

            <p className="mt-3 rounded-xl border border-base-300/70 px-3 py-2 text-[11px] leading-snug text-base-content/50">
              Nivel de esta solicitud: {shareLevelLabel(request.share_level)}.{' '}
              {shareLevelHint(request.share_level)}
            </p>
          </section>
        </div>
      ) : null}

      {tab === 'briefing' ? (
        <section className="space-y-3">
          {briefingQuery.isLoading ? <Loading label="Generando el briefing…" /> : null}

          {briefingQuery.isError ? (
            briefingLocked ? (
              <div className="vl-card border-warning/40 bg-warning/5 p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/15 text-warning">
                  <Lock className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-base font-semibold">Briefing bloqueado</h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-base-content/60">
                  La historia completa y el briefing se abren cuando la solicitud está aceptada.
                  Antes de aceptar solo se comparte el resumen clínico no identificativo
                  (minimización RGPD).
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setTab('detail')}
                  >
                    Ver resumen disponible
                  </button>
                  {specialistRole && status === 'REQUESTED' ? (
                    <span className="badge badge-warning gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Acepta la solicitud para desbloquearlo
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <ErrorState
                error={briefingQuery.error}
                title="No se pudo generar el briefing"
                onRetry={() => briefingQuery.refetch()}
              />
            )
          ) : null}

          {briefingQuery.data?.briefing ? (
            <>
              <div className="vl-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="vl-section-title">VetBriefing · pre-visita</p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight">
                      {briefingQuery.data.briefing.patient_label ?? patientSummary?.name ?? 'Briefing'}
                    </h2>
                    {briefingQuery.data.briefing.headline ? (
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-base-content/65">
                        {briefingQuery.data.briefing.headline}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {briefingQuery.data.unlocked_at ? (
                      <span className="badge badge-sm badge-ghost">
                        desbloqueado {relativeTime(briefingQuery.data.unlocked_at)}
                      </span>
                    ) : null}
                    {briefingQuery.data.briefing.data_freshness_days != null ? (
                      <span className="badge badge-sm badge-outline">
                        datos de hace {briefingQuery.data.briefing.data_freshness_days} días
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3">
                  <AlertCountChips counts={briefingQuery.data.briefing.alert_counts} />
                </div>

                {briefingQuery.data.briefing.data_gaps &&
                briefingQuery.data.briefing.data_gaps.length > 0 ? (
                  <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-base-content/60">
                    <span className="font-semibold">Datos que faltan: </span>
                    {briefingQuery.data.briefing.data_gaps.join(' · ')}
                  </p>
                ) : null}
              </div>

              <div className="vl-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Acciones prioritarias
                </h3>
                {briefingQuery.data.briefing.priority_actions &&
                briefingQuery.data.briefing.priority_actions.length > 0 ? (
                  <ol className="mt-2 space-y-2">
                    {briefingQuery.data.briefing.priority_actions.map((action, index) => {
                      const style = severityStyle(action.severity);
                      return (
                        <li key={index} className="flex items-start gap-2">
                          <span className={`badge badge-sm mt-0.5 shrink-0 ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="text-sm leading-snug text-base-content/75">
                            <span className="font-semibold">{action.title}</span>
                            {action.action ? (
                              <span className="block text-[12px] text-base-content/55">
                                {action.action}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-1 text-[13px] text-base-content/50">
                    Sin acciones marcadas por las reglas.
                  </p>
                )}
              </div>

              {briefingQuery.data.briefing.alerts_rendered &&
              briefingQuery.data.briefing.alerts_rendered.length > 0 ? (
                <div className="space-y-2.5">
                  <h3 className="text-sm font-semibold">
                    Alertas del registro ({briefingQuery.data.briefing.alerts_total ?? '—'})
                  </h3>
                  {sortAlerts(briefingQuery.data.briefing.alerts_rendered).map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              ) : null}

              {briefingQuery.data.record_meta ? (
                <div className="vl-card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-[11px] text-base-content/50">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                    registro v{briefingQuery.data.record_meta.record_version ?? '—'} ·{' '}
                    {briefingQuery.data.record_meta.source_system ?? 'origen desconocido'}
                  </span>
                  <span>
                    importado {formatDateTime(briefingQuery.data.record_meta.imported_at)}
                  </span>
                  <span>{briefingQuery.data.record_meta.alerts_count ?? 0} alertas</span>
                </div>
              ) : null}

              <details className="vl-card p-4">
                <summary className="cursor-pointer text-[12px] font-medium text-base-content/55">
                  Ver briefing completo (JSON)
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-base-200/70 p-3 font-mono text-[11px] leading-relaxed text-base-content/70">
                  {JSON.stringify(briefingQuery.data.briefing, null, 2)}
                </pre>
              </details>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section className="vl-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-secondary" />
              Auditoría de acceso
            </h2>
            <span className="text-[11px] text-base-content/40">quién vio qué y cuándo</span>
          </div>

          {auditQuery.isLoading ? <Loading label="Cargando auditoría…" compact /> : null}
          {auditQuery.isError ? (
            <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
              {auditQuery.error.message}
            </p>
          ) : null}

          {auditQuery.data ? (
            (auditQuery.data.events ?? []).length === 0 ? (
              <p className="mt-3 text-[13px] text-base-content/50">
                Todavía no hay eventos registrados para esta solicitud.
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-base-300/60">
                {(auditQuery.data.events ?? []).map((event, index) => (
                  <li
                    key={event.id ?? index}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-[12px]"
                  >
                    <span className="font-mono text-[11px] text-base-content/40">
                      {formatDateTime(event.created_at)}
                    </span>
                    <span className="font-semibold text-base-content/80">
                      {event.actor ?? 'sistema'}
                    </span>
                    {event.role ? (
                      <span className="badge badge-xs badge-ghost uppercase">{event.role}</span>
                    ) : null}
                    <span className="text-base-content/60">{event.action ?? 'evento'}</span>
                    {event.entity_type ? (
                      <span className="font-mono text-[10px] text-base-content/35">
                        {event.entity_type}
                        {event.entity_id ? `:${String(event.entity_id).slice(0, 12)}` : ''}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )
          ) : null}
        </section>
      ) : null}

      {status === 'DECLINED' || status === 'CANCELLED' ? (
        <div className="alert alert-warning items-start text-sm">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            {status === 'DECLINED'
              ? 'El especialista ha rechazado la solicitud. Puedes buscar otro especialista.'
              : 'La clínica ha cancelado esta solicitud.'}
          </span>
          {!specialistRole ? (
            <Link to="/specialists" className="btn btn-xs btn-outline ml-auto gap-1">
              <Stethoscope className="h-3.5 w-3.5" />
              Buscar otro
            </Link>
          ) : null}
        </div>
      ) : null}

      {!specialistRole && unlocked ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-base-content/40">
          <Send className="inline h-3 w-3" />
          Visita confirmada: revisa la agenda en el calendario.
        </p>
      ) : null}

      {specialistRole && String(request.urgencia ?? '').toUpperCase() === 'ALTA' && status === 'REQUESTED' ? (
        <p className="text-center text-[11px] text-error">
          Urgencia alta · prioriza esta solicitud en tu agenda
        </p>
      ) : null}
    </div>
  );
}

export default RequestDetail;
