import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { triggerBlobDownload } from '@/lib/download';
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

/**
 * The same day as a printable prep sheet. Without a city it prints every city in one PDF; with
 * one, just that kitchen's sheet.
 */
export function usePoLookupPdfDownload() {
  return useMutation({
    mutationFn: async ({ date, city }: { date: string; city?: string }) => {
      const res = await apiClient.get('/po-lookup/pdf', {
        params: { date, ...(city ? { city } : {}) },
        responseType: 'blob',
      });
      const slug = city ? `-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
      triggerBlobDownload(res.data as Blob, `po-lookup${slug}-${date}.pdf`);
    },
    onError: () => toast.error('Failed to generate PDF'),
  });
}
