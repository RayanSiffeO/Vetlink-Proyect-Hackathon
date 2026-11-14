import { Link, useParams } from 'react-router-dom';
import { BackLink } from '../components/BackLink';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { AcceptPanel } from '../components/request/RequestAcceptPanel';
import { AuditTab } from '../components/request/RequestAuditTab';
import { BriefingTab } from '../components/request/RequestBriefingTab';
import { RequestClosePanel } from '../components/request/RequestClosePanel';
import { DetailTab } from '../components/request/RequestDetailTab';
import { ActionErrorBanner, RequestHeaderCard } from '../components/request/RequestHeader';
import {
  ClosedNotice,
  ConfirmedFooter,
  UnlockedNotice,
  UrgentNote,
} from '../components/request/RequestNotices';
import { RequestTabs } from '../components/request/RequestTabs';
import { useIsSpecialist, useRequest } from '../api/hooks';
import type { RequestDetailResponse } from '../api/types';
import { findRequestAppointment } from '../lib/appointments';
import { useRequestScreen, type RequestScreenState } from '../hooks/useRequestScreen';

function RequestNotFound() {
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

function RequestTabPanels({
  id,
  data,
  screen,
}: {
  id: string;
  data: RequestDetailResponse;
  screen: RequestScreenState;
}) {
  if (screen.tab === 'detail') {
    return <DetailTab data={data} summaryQuery={screen.summaryQuery} />;
  }
  if (screen.tab === 'briefing') {
    return <BriefingTab id={id} data={data} onShowDetail={() => screen.setTab('detail')} />;
  }
  return <AuditTab query={screen.auditQuery} />;
}

function RequestDetailScreen({
  id,
  data,
  screen,
}: {
  id: string;
  data: RequestDetailResponse;
  screen: RequestScreenState;
}) {
  const request = data.request;
  const status = String(request.status ?? '').toUpperCase();
  const specialistRole = useIsSpecialist();
  const appointment = findRequestAppointment(screen.appointmentsQuery.data?.appointments, request.id);

  return (
    <div className="space-y-6">
      <BackLink to="/requests">Solicitudes</BackLink>
      <RequestHeaderCard data={data} appointment={appointment} cancel={screen.cancel} />
      <ActionErrorBanner error={screen.actionError} />
      {specialistRole && status === 'REQUESTED' ? (
        <AcceptPanel request={request} actions={{ accept: screen.accept, decline: screen.decline }} />
      ) : null}
      <UnlockedNotice status={status} />
      <RequestTabs tab={screen.tab} onSelect={screen.setTab} />
      <RequestTabPanels id={id} data={data} screen={screen} />
      {specialistRole && screen.tab === 'detail' ? (
        <RequestClosePanel request={request} />
      ) : null}
      <ClosedNotice status={status} />
      <ConfirmedFooter status={status} />
      <UrgentNote request={request} />
    </div>
  );
}

export function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const query = useRequest(id);
  const screen = useRequestScreen(id);

  if (query.isLoading) return <Loading label="Cargando la solicitud…" />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudo cargar la solicitud"
        onRetry={() => query.refetch()}
        hint="Puede que la demo se haya reiniciado"
      />
    );
  }
  if (!query.data?.request) return <RequestNotFound />;
  return <RequestDetailScreen id={id ?? ''} data={query.data} screen={screen} />;
}

export default RequestDetail;
