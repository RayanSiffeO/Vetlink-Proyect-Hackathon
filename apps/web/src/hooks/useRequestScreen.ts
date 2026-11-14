import { useSearchParams } from 'react-router-dom';
import {
  useAcceptRequest,
  useAppointments,
  useCancelRequest,
  useDeclineRequest,
  useRequestAudit,
  useRequestSummary,
} from '../api/hooks';
import { resolveRequestTab, type RequestTab } from '../lib/requests';

export interface RequestScreenState {
  tab: RequestTab;
  setTab: (tab: RequestTab) => void;
  summaryQuery: ReturnType<typeof useRequestSummary>;
  auditQuery: ReturnType<typeof useRequestAudit>;
  appointmentsQuery: ReturnType<typeof useAppointments>;
  accept: ReturnType<typeof useAcceptRequest>;
  decline: ReturnType<typeof useDeclineRequest>;
  cancel: ReturnType<typeof useCancelRequest>;
  actionError: Error | null;
}

export function useRequestScreen(id: string | undefined): RequestScreenState {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveRequestTab(searchParams.get('tab'));
  const summaryQuery = useRequestSummary(id);
  const auditQuery = useRequestAudit(id);
  const appointmentsQuery = useAppointments();
  const accept = useAcceptRequest(id);
  const decline = useDeclineRequest(id);
  const cancel = useCancelRequest(id);

  const setTab = (next: RequestTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'detail') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return {
    tab,
    setTab,
    summaryQuery,
    auditQuery,
    appointmentsQuery,
    accept,
    decline,
    cancel,
    actionError: accept.error ?? decline.error ?? cancel.error,
  };
}
