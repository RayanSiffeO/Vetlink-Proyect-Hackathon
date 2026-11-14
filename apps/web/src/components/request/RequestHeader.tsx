import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardList, XCircle } from 'lucide-react';
import type { Appointment, RequestDetailResponse, RequestRecord } from '../../api/types';
import { useCancelRequest, useIsSpecialist } from '../../api/hooks';
import { formatDateTime, formatPreferredSlots, relativeTime } from '../../lib/format';
import { canCancelRequest } from '../../lib/requests';
import { ShareBadge, StatusBadge, UrgencyBadge } from '../badges';
import { Spinner } from '../Spinner';

function ScheduledBadge({ appointment }: { appointment: Appointment | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ok/20 bg-ok-soft px-2.5 py-1 text-[11px] font-medium leading-4 text-ok">
      <CalendarClock className="h-3 w-3" aria-hidden="true" />
      {appointment ? formatDateTime(appointment.when_iso) : 'cita confirmada'}
    </span>
  );
}

function RequestStatusBadges({
  request,
  appointment,
}: {
  request: RequestRecord;
  appointment: Appointment | null;
}) {
  const status = String(request.status ?? '').toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} variant="header" />
      <UrgencyBadge urgency={request.urgencia} icon={<AlertTriangle className="h-3 w-3" />} />
      <ShareBadge level={request.share_level} />
      {status === 'SCHEDULED' ? <ScheduledBadge appointment={appointment} /> : null}
    </div>
  );
}

function RequestHeading({
  data,
  appointment,
}: {
  data: RequestDetailResponse;
  appointment: Appointment | null;
}) {
  const request = data.request;
  const patientName = data.patient_summary?.name ?? null;
  const specialist = data.specialist ?? null;
  return (
    <div className="min-w-0">
      <RequestStatusBadges request={request} appointment={appointment} />
      <h1 className="mt-2.5 text-[28px] font-medium leading-9 tracking-[-0.025em] text-ink sm:text-[32px] sm:leading-10">
        {patientName ? `Caso de ${patientName}` : 'Solicitud de derivación'}
      </h1>
      <p className="mt-1 text-[12px] leading-[18px] text-caption">
        {specialist ? `${specialist.name} · ${specialist.specialty} · ${specialist.zone}` : ''}
        {specialist && request.created_at ? ' · ' : ''}
        {request.created_at ? `creada ${relativeTime(request.created_at)}` : `id ${request.id}`}
      </p>
    </div>
  );
}

function CancelRequestButton({ cancel }: { cancel: ReturnType<typeof useCancelRequest> }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-crit/25 bg-crit-soft/70 px-3 py-1.5 text-[12px] font-medium text-crit transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-crit-soft disabled:opacity-60"
      onClick={() => cancel.mutate()}
      disabled={cancel.isPending}
    >
      {cancel.isPending ? <Spinner size="xs" /> : <XCircle className="h-3.5 w-3.5" />}
      Cancelar
    </button>
  );
}

function RequestHeaderActions({
  request,
  cancel,
}: {
  request: RequestRecord;
  cancel: ReturnType<typeof useCancelRequest>;
}) {
  const specialistRole = useIsSpecialist();
  const status = String(request.status ?? '').toUpperCase();
  const canCancel = canCancelRequest(status, specialistRole);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {request.patient_id && !specialistRole ? (
        <Link
          to={`/patients/${request.patient_id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white/70 px-3 py-1.5 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Ficha completa
        </Link>
      ) : null}
      {canCancel ? <CancelRequestButton cancel={cancel} /> : null}
    </div>
  );
}

function RequestReasonGrid({ request }: { request: RequestRecord }) {
  return (
    <div className="mx-5 mb-5 grid gap-2 rounded-2xl border border-line bg-white/60 p-3 text-[12px] sm:mx-6 sm:grid-cols-2">
      <p>
        <span className="vl-label block">Motivo de la derivación</span>
        <span className="mt-0.5 block leading-[18px] text-para">{request.motivo || '—'}</span>
      </p>
      <p>
        <span className="vl-label block">Franjas preferidas</span>
        <span className="mt-0.5 block leading-[18px] text-para">
          {request.preferred ? formatPreferredSlots(request.preferred) : 'Sin preferencia declarada'}
        </span>
      </p>
    </div>
  );
}

export function RequestHeaderCard({
  data,
  appointment,
  cancel,
}: {
  data: RequestDetailResponse;
  appointment: Appointment | null;
  cancel: ReturnType<typeof useCancelRequest>;
}) {
  return (
    <header className="glass-strong overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
        <RequestHeading data={data} appointment={appointment} />
        <RequestHeaderActions request={data.request} cancel={cancel} />
      </div>
      <RequestReasonGrid request={data.request} />
    </header>
  );
}

export function ActionErrorBanner({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <div
      className="flex items-start gap-2.5 rounded-2xl border border-crit/25 bg-crit-soft px-4 py-3 text-[13px] leading-5 text-crit"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error.message}</span>
    </div>
  );
}
