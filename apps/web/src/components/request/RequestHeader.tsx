import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardList, XCircle } from 'lucide-react';
import type { Appointment, RequestDetailResponse, RequestRecord } from '../../api/types';
import { useCancelRequest, useIsSpecialist } from '../../api/hooks';
import { formatDateTime, relativeTime } from '../../lib/format';
import { canCancelRequest } from '../../lib/requests';
import { ShareBadge, StatusBadge, UrgencyBadge } from '../badges';
import { Spinner } from '../Spinner';

function ScheduledBadge({ appointment }: { appointment: Appointment | null }) {
  return (
    <span className="badge badge-sm badge-success gap-1">
      <CalendarClock className="h-3 w-3" />
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
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {patientName ? `Caso de ${patientName}` : 'Solicitud de derivación'}
      </h1>
      <p className="mt-0.5 text-[12px] text-base-content/45">
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
      className="btn btn-outline btn-error btn-sm gap-1.5"
      onClick={() => cancel.mutate()}
      disabled={cancel.isPending}
    >
      {cancel.isPending ? <Spinner size="xs" /> : <XCircle className="h-4 w-4" />}
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
        <Link to={`/patients/${request.patient_id}`} className="btn btn-ghost btn-sm gap-1.5">
          <ClipboardList className="h-4 w-4" />
          Ficha completa
        </Link>
      ) : null}
      {canCancel ? <CancelRequestButton cancel={cancel} /> : null}
    </div>
  );
}

function RequestReasonGrid({ request }: { request: RequestRecord }) {
  return (
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
    <header className="vl-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
    <div className="alert alert-error flex items-start gap-3 text-left text-sm" role="alert">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{error.message}</span>
    </div>
  );
}
