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
    <div className="flex flex-wrap items-center gap-1.5">
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
      <h3 className="mt-2 truncate text-[16.5px] font-medium leading-6 tracking-[-0.01em] text-ink">
        {patientName ??
          (request.patient_id ? `Paciente ${String(request.patient_id).slice(0, 8)}` : 'Solicitud')}
      </h3>
      {specialistName ? (
        <p className="truncate text-[12px] leading-[18px] text-caption">{specialistName}</p>
      ) : null}
    </div>
  );
}

function RequestMeta({ request }: { request: RequestRecord }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-caption">
      {request.patient_species ? <span>{request.patient_species}</span> : null}
      {request.patient_species && request.specialist_specialty ? (
        <span className="text-line-strong">·</span>
      ) : null}
      {request.specialist_specialty ? (
        <span className="inline-flex items-center gap-1">
          <Stethoscope className="h-3 w-3" aria-hidden="true" />
          {request.specialist_specialty}
        </span>
      ) : null}
    </div>
  );
}

function RequestFooter({ request }: { request: RequestRecord }) {
  const when = (request.slot_iso as string | undefined) ?? (request.when_iso as string | undefined);
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/80 pt-2.5 text-[11px] leading-4 text-caption">
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        {request.created_at ? relativeTime(request.created_at) : 'fecha sin registrar'}
      </span>
      {when ? (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" aria-hidden="true" />
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
      className="group flex flex-col gap-3 rounded-card border border-line bg-white/70 p-4 shadow-soft transition duration-300 ease-smooth hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-white/90 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <RequestTitle request={request} />
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700 transition duration-200 ease-smooth group-hover:bg-indigo group-hover:text-white">
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className="line-clamp-2 text-[12.5px] leading-[18px] text-para">
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
        <div className="flex flex-wrap gap-2">
          <Link
            to="/specialists"
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white/70 px-3 py-1.5 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Buscar especialista
          </Link>
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo px-3.5 py-1.5 text-[12px] font-medium text-white shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
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
