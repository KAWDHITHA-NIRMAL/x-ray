import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpUtil } from '@/utils';

export interface UrbanProxy {
  id: string;
  country: string;
  countryCode: string;
  group: string;
  serverName: string;
  host: string;
  port: number;
  username: string;
  password: string;
  proxyUrl: string;
  curlTest: string;
  weight: number;
  pool: string;
  latency: number | null;
  updatedAt: string;
  expiresAt: string;
}

export interface UrbanCountrySummary {
  country: string;
  countryCode: string;
  group: string;
  proxyCount: number;
  avgLatency: number | null;
  servers: UrbanProxy[];
}

export interface ProxiesListResponse {
  proxies: UrbanProxy[];
  total: number;
  filteredTotal: number;
  groups: string[];
  countriesCount: number;
  lastRefreshed: number;
  nextRefresh?: number;
  autoRefreshMinutes: number;
  idleLimitMinutes?: number;
  cyclesCount?: number;
}

export function useProxiesQuery(params?: { group?: string; country?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.group && params.group !== 'all') qs.set('group', params.group);
  if (params?.country) qs.set('country', params.country);
  if (params?.search) qs.set('search', params.search);

  const queryPath = `/panel/api/proxies/list${qs.toString() ? `?${qs.toString()}` : ''}`;

  return useQuery<ProxiesListResponse>({
    queryKey: ['proxies', 'list', params?.group, params?.country, params?.search],
    queryFn: async () => {
      const res = await HttpUtil.get(queryPath, undefined, { silent: true });
      if (!res?.success || !res?.obj) {
        throw new Error(res?.msg || 'Failed to fetch proxies');
      }
      return res.obj as ProxiesListResponse;
    },
    refetchInterval: 60_000,
  });
}

export function useProxyCountriesQuery() {
  return useQuery<UrbanCountrySummary[]>({
    queryKey: ['proxies', 'countries'],
    queryFn: async () => {
      const res = await HttpUtil.get('/panel/api/proxies/countries', undefined, { silent: true });
      if (!res?.success || !res?.obj) {
        return [];
      }
      return res.obj as UrbanCountrySummary[];
    },
    staleTime: 60_000,
  });
}

export interface PingResult {
  latency?: number | null;
  ok?: boolean;
  host?: string;
  port?: number;
  tested?: number;
  online?: number;
  results?: Record<string, number | null>;
  error?: string;
}

export function usePingProxyMutation() {
  const queryClient = useQueryClient();
  return useMutation<PingResult, Error, { host?: string; port?: number; all?: boolean }>({
    mutationFn: async (payload: { host?: string; port?: number; all?: boolean }) => {
      const res = await HttpUtil.post('/panel/api/proxies/ping', payload, { silent: true });
      return (res?.obj || {}) as PingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
    },
  });
}

export function useRefreshProxiesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await HttpUtil.post('/panel/api/proxies/refresh', {}, { silent: false });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
    },
  });
}
