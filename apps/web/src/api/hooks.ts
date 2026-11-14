import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { ApiError, request } from './client';
import { isSpecialist } from '../lib/format';
import type {
  AppointmentsResponse,
  AuditResponse,
  BriefingResponse,
  CreateRequestPayload,
  DemoUserId,
  ImportResponse,
  LoginResponse,
  MeResponse,
  PatientRecordResponse,
  PatientsResponse,
  PublicSummary,
  RequestDetailResponse,
  RequestRecord,
  RequestsResponse,
  ResetResponse,
  ReviewRecordPayload,
  ReviewResponse,
  SpecialistDetailResponse,
  SpecialistsResponse,
  Urgency,
  User,
} from './types';

export const qk = {
  me: ['me'] as QueryKey,
  patients: ['patients'] as QueryKey,
  patientRecord: (id: string) => ['patient', id, 'record'] as QueryKey,
  specialists: (specialty: string, zone: string) => ['specialists', specialty, zone] as QueryKey,
  specialist: (id: string) => ['specialist', id] as QueryKey,
  requests: ['requests'] as QueryKey,
  request: (id: string) => ['request', id] as QueryKey,
  requestSummary: (id: string) => ['request', id, 'summary'] as QueryKey,
  briefing: (id: string) => ['request', id, 'briefing'] as QueryKey,
  audit: (id: string) => ['request', id, 'audit'] as QueryKey,
  appointments: ['appointments'] as QueryKey,
};

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.isUnauthorized;
}

export function useMe() {
  return useQuery<User | null>({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        const data = await request<MeResponse>('/me');
        return data?.user ?? null;
      } catch (error) {
        if (isUnauthorizedError(error)) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useIsSpecialist(): boolean {
  const { data: user } = useMe();
  return isSpecialist(user);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<LoginResponse, Error, DemoUserId>({
    mutationFn: (user) => request<LoginResponse>('/auth/demo', { method: 'POST', body: { user } }),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.me, data.user);
      queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => request<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(qk.me, null);
      queryClient.clear();
    },
    onError: () => {
      queryClient.setQueryData(qk.me, null);
    },
  });
}

export function useResetDemo() {
  const queryClient = useQueryClient();
  return useMutation<ResetResponse, Error, void>({
    mutationFn: () => request<ResetResponse>('/demo/reset', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function usePatients() {
  return useQuery<PatientsResponse>({
    queryKey: qk.patients,
    queryFn: () => request<PatientsResponse>('/patients'),
    retry: 1,
  });
}

export function usePatientRecord(id: string | undefined) {
  return useQuery<PatientRecordResponse>({
    queryKey: qk.patientRecord(id ?? ''),
    queryFn: () => request<PatientRecordResponse>(`/patients/${encodeURIComponent(id!)}/record`),
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useReviewRecord(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<ReviewResponse, Error, ReviewRecordPayload>({
    mutationFn: (payload) =>
      request<ReviewResponse>(`/patients/${encodeURIComponent(patientId!)}/record/review`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patientRecord(patientId ?? '') });
      queryClient.invalidateQueries({ queryKey: qk.patients });
    },
  });
}

function filesToFormData(files: File[]): FormData {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file, file.name));
  return formData;
}

export function useImportFiles() {
  const queryClient = useQueryClient();
  return useMutation<ImportResponse, Error, File[]>({
    mutationFn: (files) =>
      request<ImportResponse>('/imports', { method: 'POST', formData: filesToFormData(files) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patients });
    },
  });
}

function specialistQueryString(specialty: string, zone: string): string {
  const params = new URLSearchParams();
  if (specialty.trim()) params.set('specialty', specialty.trim());
  if (zone.trim()) params.set('zone', zone.trim());
  return params.toString();
}

export function useSpecialists(specialty: string, zone: string) {
  return useQuery<SpecialistsResponse>({
    queryKey: qk.specialists(specialty, zone),
    queryFn: () => {
      const queryString = specialistQueryString(specialty, zone);
      const suffix = queryString ? `?${queryString}` : '';
      return request<SpecialistsResponse>(`/specialists${suffix}`);
    },
    retry: 1,
  });
}

export function useSpecialist(id: string | undefined) {
  return useQuery<SpecialistDetailResponse>({
    queryKey: qk.specialist(id ?? ''),
    queryFn: () => request<SpecialistDetailResponse>(`/specialists/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useRequests() {
  return useQuery<RequestsResponse>({
    queryKey: qk.requests,
    queryFn: () => request<RequestsResponse>('/requests'),
    retry: 1,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation<RequestDetailResponse, Error, CreateRequestPayload>({
    mutationFn: (payload) =>
      request<RequestDetailResponse>('/requests', { method: 'POST', body: payload }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.requests });
      const created = data?.request as RequestRecord | undefined;
      if (!created?.id) return;
      queryClient.invalidateQueries({ queryKey: qk.request(created.id) });
    },
  });
}

export function useRequest(id: string | undefined) {
  return useQuery<RequestDetailResponse>({
    queryKey: qk.request(id ?? ''),
    queryFn: () => request<RequestDetailResponse>(`/requests/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useRequestSummary(id: string | undefined, enabled = true) {
  return useQuery<PublicSummary>({
    queryKey: qk.requestSummary(id ?? ''),
    queryFn: () => request<PublicSummary>(`/requests/${encodeURIComponent(id!)}/summary`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useBriefing(id: string | undefined, enabled = true) {
  return useQuery<BriefingResponse>({
    queryKey: qk.briefing(id ?? ''),
    queryFn: () => request<BriefingResponse>(`/requests/${encodeURIComponent(id!)}/briefing`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useRequestAudit(id: string | undefined, enabled = true) {
  return useQuery<AuditResponse>({
    queryKey: qk.audit(id ?? ''),
    queryFn: () => request<AuditResponse>(`/requests/${encodeURIComponent(id!)}/audit`),
    enabled: Boolean(id) && enabled,
    retry: 1,
  });
}

function invalidateRequestData(queryClient: QueryClient, id: string | undefined): void {
  queryClient.invalidateQueries({ queryKey: qk.requests });
  queryClient.invalidateQueries({ queryKey: qk.appointments });
  if (!id) return;
  queryClient.invalidateQueries({ queryKey: qk.request(id) });
  queryClient.invalidateQueries({ queryKey: qk.audit(id) });
  queryClient.invalidateQueries({ queryKey: qk.briefing(id) });
}

function useRequestTransition<TBody>(id: string | undefined, action: string) {
  const queryClient = useQueryClient();
  return useMutation<RequestDetailResponse, Error, TBody>({
    mutationFn: (body) =>
      request<RequestDetailResponse>(`/requests/${encodeURIComponent(id!)}/${action}`, {
        method: 'POST',
        body: body ?? {},
      }),
    onSuccess: () => invalidateRequestData(queryClient, id),
  });
}

export function useAcceptRequest(id: string | undefined) {
  return useRequestTransition<{ slot_iso: string }>(id, 'accept');
}

export function useDeclineRequest(id: string | undefined) {
  return useRequestTransition<void>(id, 'decline');
}

export function useCancelRequest(id: string | undefined) {
  return useRequestTransition<void>(id, 'cancel');
}

export function useAppointments() {
  return useQuery<AppointmentsResponse>({
    queryKey: qk.appointments,
    queryFn: () => request<AppointmentsResponse>('/appointments'),
    retry: 1,
  });
}

export interface UrgencyOption {
  value: Urgency;
  label: string;
  hint: string;
}

export const URGENCY_OPTIONS: UrgencyOption[] = [
  { value: 'BAJA', label: 'Baja', hint: 'Puede esperar a la agenda habitual' },
  { value: 'MEDIA', label: 'Media', hint: 'Conviene verlo en los próximos días' },
  { value: 'ALTA', label: 'Urgente', hint: 'No puede esperar más de 24-48 h' },
];
