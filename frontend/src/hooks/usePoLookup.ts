import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, PoLookupCity } from '@/types/api';

/** What each city's prep kitchen has to produce for one delivery day. */
export function usePoLookup(date: string) {
  return useQuery({
    queryKey: ['po-lookup', date],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<PoLookupCity[]>>('/po-lookup', { params: { date } })).data.data,
    enabled: Boolean(date),
  });
}
