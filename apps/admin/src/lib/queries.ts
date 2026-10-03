import type {
  AdminCreateRequest,
  AdminProfile,
  AdminUpdateRequest,
  AnchorRow,
  AnchorRunResponse,
  AppSettings,
  AssessmentDetail,
  AssessmentRow,
  CertificateRow,
  ChainStatus,
  DashboardResponse,
  DeviceRow,
  ModuleDetail,
  ModuleStats,
  Page,
  Site,
  SiteCreateRequest,
  TrustBundle,
  VerifyResponse,
  WorkerCreateRequest,
  WorkerDetail,
  WorkerRow,
  WorkerUpdateRequest,
} from '@ar-training/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useFilters } from './filters';

type Params = Record<string, string | number | boolean | null | undefined>;

export function useDashboard() {
  const { range, sector } = useFilters();
  return useQuery({
    queryKey: ['dashboard', range, sector],
    queryFn: () => api<DashboardResponse>('/api/dashboard', { query: { range, sector } }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useAssessments(params: Params) {
  const { range, sector } = useFilters();
  const query = { range, sector, ...params };
  return useQuery({
    queryKey: ['assessments', query],
    queryFn: () => api<Page<AssessmentRow>>('/api/assessments', { query }),
    placeholderData: keepPreviousData,
  });
}

export function useAssessment(resultId: string | null) {
  return useQuery({
    queryKey: ['assessment', resultId],
    queryFn: () => api<AssessmentDetail>(`/api/assessments/${resultId}`),
    enabled: resultId != null,
  });
}

export function useWorkers(params: Params) {
  const { sector } = useFilters();
  const query = { sector, ...params };
  return useQuery({
    queryKey: ['workers', query],
    queryFn: () => api<Page<WorkerRow>>('/api/workers', { query }),
    placeholderData: keepPreviousData,
  });
}

export function useWorker(workerId: string | undefined) {
  return useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => api<WorkerDetail>(`/api/workers/${workerId}`),
    enabled: workerId != null,
  });
}

export function useModules() {
  const { range, sector } = useFilters();
  return useQuery({
    queryKey: ['modules', range, sector],
    queryFn: () => api<ModuleStats[]>('/api/modules', { query: { range, sector } }),
    placeholderData: keepPreviousData,
  });
}

export function useModule(moduleId: string | undefined) {
  const { range, sector } = useFilters();
  return useQuery({
    queryKey: ['module', moduleId, range, sector],
    queryFn: () => api<ModuleDetail>(`/api/modules/${moduleId}`, { query: { range, sector } }),
    enabled: moduleId != null,
    placeholderData: keepPreviousData,
  });
}

export function useCertificates(params: Params) {
  const { sector } = useFilters();
  const query = { sector, ...params };
  return useQuery({
    queryKey: ['certificates', query],
    queryFn: () => api<Page<CertificateRow>>('/api/certificates', { query }),
    placeholderData: keepPreviousData,
  });
}

export function useSites() {
  return useQuery({ queryKey: ['sites'], queryFn: () => api<Site[]>('/api/sites') });
}

export function useAppSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api<AppSettings>('/api/settings') });
}

export function useAdmins() {
  return useQuery({ queryKey: ['admins'], queryFn: () => api<AdminProfile[]>('/api/admins') });
}

export function useDevices() {
  return useQuery({ queryKey: ['devices'], queryFn: () => api<DeviceRow[]>('/api/devices') });
}

export function useChainStatus() {
  return useQuery({ queryKey: ['chain'], queryFn: () => api<ChainStatus>('/api/chain/status') });
}

export function useAnchors(params: Params) {
  return useQuery({
    queryKey: ['anchors', params],
    queryFn: () => api<Page<AnchorRow>>('/api/chain/anchors', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useTrustBundle() {
  return useQuery({
    queryKey: ['trust'],
    queryFn: () => api<TrustBundle>('/api/certificates/keys', { auth: false }),
    staleTime: 60_000,
  });
}

export function fetchVerification(certificateId: string) {
  return api<VerifyResponse>(`/api/verify/${encodeURIComponent(certificateId)}`, { auth: false });
}

// ---- Mutations --------------------------------------------------------------------------------

function useInvalidate() {
  const client = useQueryClient();
  return (...keys: string[]) =>
    Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));
}

export function useRevokeCertificate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<CertificateRow>(`/api/certificates/${id}/revoke`, { method: 'POST', body: { reason } }),
    onSuccess: () => invalidate('certificates', 'dashboard', 'worker', 'workers', 'trust'),
  });
}

export function useCreateWorker() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: WorkerCreateRequest) =>
      api<WorkerDetail>('/api/workers', { method: 'POST', body }),
    onSuccess: () => invalidate('workers', 'dashboard', 'sites'),
  });
}

export function useUpdateWorker() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WorkerUpdateRequest }) =>
      api<WorkerDetail>(`/api/workers/${id}`, { method: 'PATCH', body }),
    onSuccess: () => invalidate('workers', 'worker', 'dashboard'),
  });
}

export function useSaveSettings() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: AppSettings) => api<AppSettings>('/api/settings', { method: 'PUT', body }),
    onSuccess: () => invalidate('settings', 'dashboard'),
  });
}

export function useCreateSite() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SiteCreateRequest) => api<Site>('/api/sites', { method: 'POST', body }),
    onSuccess: () => invalidate('sites', 'dashboard'),
  });
}

export function useCreateAdmin() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: AdminCreateRequest) =>
      api<AdminProfile>('/api/admins', { method: 'POST', body }),
    onSuccess: () => invalidate('admins'),
  });
}

export function useUpdateAdmin() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminUpdateRequest }) =>
      api<AdminProfile>(`/api/admins/${id}`, { method: 'PATCH', body }),
    onSuccess: () => invalidate('admins'),
  });
}

export function useRunAnchoring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api<AnchorRunResponse>('/api/chain/anchor', { method: 'POST' }),
    onSuccess: () => invalidate('anchors', 'chain', 'certificates', 'dashboard'),
  });
}
