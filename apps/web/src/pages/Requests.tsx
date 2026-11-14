import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Clock3, Plus, Send, Stethoscope } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { CardGrid } from '../components/CardGrid';
import { PageHeader } from '../components/PageHeader';
import { ShareBadge, StatusBadge, UrgencyBadge } from '../components/badges';
import { useIsSpecialist, useRequests } from '../api/hooks';
import type { RequestRecord } from '../api/types';
import { formatDateTime, relativeTime } from '../lib/format';

function RequestBadgeRow({ request }: { request: RequestRecord }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={String(request.status)} />
      <UrgencyBadge urgency={request.urgencia} />
      <ShareBadge level={request.share_level} />
    </div>
  );
}

function RequestTitle({ request }: { request: RequestRecord }) {
  const patientName = (request.patient_name as string | undefined) ?? null;
  const specialistName = (request.specialist_name as string | undefined) ?? null;
  return (
    <div className="min-w-0">
      <RequestBadgeRow request={request} />
      <h3 className="mt-1.5 truncate text-base font-semibold">
        {patientName ??
          (request.patient_id ? `Paciente ${String(request.patient_id).slice(0, 8)}` : 'Solicitud')}
      </h3>
      {specialistName ? (
        <p className="truncate text-[12px] text-base-content/55">{specialistName}</p>
      ) : null}
    </div>
  );
}

function RequestMeta({ request }: { request: RequestRecord }) {
  return (
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
  );
}

function RequestFooter({ request }: { request: RequestRecord }) {
  const when = (request.slot_iso as string | undefined) ?? (request.when_iso as string | undefined);
  return (
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
  );
}

function RequestCard({ request }: { request: RequestRecord }) {
  return (
    <Link
      to={`/requests/${request.id}`}
      className="vl-card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <RequestTitle request={request} />
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-secondary" />
      </div>
      <p className="line-clamp-2 text-[13px] leading-snug text-base-content/60">
        {request.motivo || 'Sin motivo registrado'}
      </p>
      <RequestMeta request={request} />
      <RequestFooter request={request} />
    </Link>
  );
}

function RequestsEmpty() {
  const specialistRole = useIsSpecialist();
  return (
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
  );
}

function RequestsBody({ query }: { query: ReturnType<typeof useRequests> }) {
  if (query.isLoading) return <LoadingCards count={3} />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudieron cargar las solicitudes"
        onRetry={() => query.refetch()}
      />
    );
  }
  const requests = query.data?.requests ?? [];
  if (requests.length === 0) return <RequestsEmpty />;
  return (
    <CardGrid>
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </CardGrid>
  );
}

function RequestsHeader({ specialistRole }: { specialistRole: boolean }) {
  return (
    <PageHeader
      heading={{
        eyebrow: 'VetNetwork · solicitudes',
        title: 'Solicitudes',
        description: specialistRole
          ? 'Solicitudes recibidas: acepta una franja para abrir la historia completa.'
          : 'Derivaciones enviadas a especialistas y su estado.',
        icon: Send,
      }}
    >
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
    </PageHeader>
  );
}

export function Requests() {
  const specialistRole = useIsSpecialist();
  const query = useRequests();

  return (
    <div className="space-y-6">
      <RequestsHeader specialistRole={specialistRole} />
      <RequestsBody query={query} />
    </div>
  );
}

export default Requests;
