import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Plus,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { useMe, useRequests } from '../api/hooks';
import type { RequestRecord } from '../api/types';
import {
  formatDateTime,
  isSpecialist,
  relativeTime,
  requestStatusStyle,
  urgencyBadge,
  urgencyLabel,
} from '../lib/format';

function RequestCard({ request }: { request: RequestRecord }) {
  const status = requestStatusStyle(String(request.status));
  const patientName = (request.patient_name as string | undefined) ?? null;
  const specialistName = (request.specialist_name as string | undefined) ?? null;
  const when = (request.slot_iso as string | undefined) ?? (request.when_iso as string | undefined);

  return (
    <Link
      to={`/requests/${request.id}`}
      className="vl-card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge badge-sm ${status.badge} font-semibold`}>{status.label}</span>
            <span className={`badge badge-sm ${urgencyBadge(request.urgencia)}`}>
              {urgencyLabel(request.urgencia)}
            </span>
            <span className="badge badge-sm badge-outline gap-1">
              <ShieldCheck className="h-3 w-3" />
              {String(request.share_level ?? 'CLINICAL').toUpperCase()}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold">
            {patientName ??
              (request.patient_id ? `Paciente ${String(request.patient_id).slice(0, 8)}` : 'Solicitud')}
          </h3>
          {specialistName ? (
            <p className="truncate text-[12px] text-base-content/55">{specialistName}</p>
          ) : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-secondary" />
      </div>

      <p className="line-clamp-2 text-[13px] leading-snug text-base-content/60">
        {request.motivo || 'Sin motivo registrado'}
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-base-content/45">
        {request.patient_species ? <span>{request.patient_species}</span> : null}
        {request.patient_species && request.specialist_specialty ? (
          <span className="text-base-content/25">·</span>
        ) : null}
        {request.specialist_specialty ? (
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />
            {request.specialist_specialty}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-base-300/60 pt-2.5 text-[11px] text-base-content/45">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {request.created_at ? relativeTime(request.created_at) : 'fecha sin registrar'}
        </span>
        {when ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDateTime(when)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function Requests() {
  const { data: user } = useMe();
  const { data, isLoading, isError, error, refetch } = useRequests();
  const specialistRole = isSpecialist(user);

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="vl-section-title">VetNetwork · solicitudes</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Send className="h-6 w-6 text-secondary" aria-hidden="true" />
            Solicitudes
          </h1>
          <p className="mt-1 text-sm text-base-content/55">
            {specialistRole
              ? 'Solicitudes recibidas: acepta una franja para abrir la historia completa.'
              : 'Derivaciones enviadas a especialistas y su estado.'}
          </p>
        </div>
        {!specialistRole ? (
          <div className="flex gap-2">
            <Link to="/specialists" className="btn btn-outline btn-sm gap-1.5">
              <Stethoscope className="h-4 w-4" />
              Buscar especialista
            </Link>
            <Link to="/requests/new" className="btn btn-primary btn-sm gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva solicitud
            </Link>
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <LoadingCards count={3} />
      ) : isError ? (
        <ErrorState
          error={error}
          title="No se pudieron cargar las solicitudes"
          onRetry={() => refetch()}
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Sin solicitudes"
          description={
            specialistRole
              ? 'Cuando una clínica te derive un caso aparecerá aquí con su resumen clínico anónimo.'
              : 'Deriva un caso a un especialista para verlo aquí.'
          }
          action={
            !specialistRole ? (
              <Link to="/specialists" className="btn btn-primary btn-sm">
                Buscar especialista
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Requests;
