import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useRangeParams } from '@/hooks/useRangeParams';
import type { ApiEnvelope, ClassAItem, ClassAItemSummaryRow, ClassAItemType } from '@/types/api';

export function useClassAItems(brand: string) {
  return useQuery({
    queryKey: ['class-a-items', brand],
    queryFn: async () => (await apiClient.get<ApiEnvelope<ClassAItem[]>>('/class-a-items', { params: { brand } })).data.data,
  });
}

export function useClassAItemsSummary({ brand, outletId }: { brand: string; outletId: string }) {
  const rangeParams = useRangeParams({ outletId, brand });
  // useRangeParams omits `brand` once a specific outletId is chosen (it's only a fallback
  // there), but the summary endpoint always needs `brand` to know which curated list to load.
  const params = { ...rangeParams, brand };

  return useQuery({
    queryKey: ['class-a-items-summary', params],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<ClassAItemSummaryRow[]>>('/class-a-items/summary', { params })).data.data,
  });
}

export function useAddClassAItem() {
  const qc = useQueryClient();
  // The backend rejects item names that don't exist in Sales/Purchase data and returns
  // the closest real names, which callers render as click-to-fill suggestions.
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async (input: { brand: string; type: ClassAItemType; value: string }) => apiClient.post('/class-a-items', input),
    onMutate: () => setSuggestions([]),
    onSuccess: (_data, input) => {
      toast.success(`Added ${input.value} to Class A items`);
      qc.invalidateQueries({ queryKey: ['class-a-items', input.brand] });
      qc.invalidateQueries({ queryKey: ['class-a-items-summary'] });
      // Reconciliation's ingredient list is derived from Class A Items — without this,
      // an added item wouldn't show up there until something else triggered a refetch.
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error) => {
      const body = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string; details?: { suggestions?: string[] } } | undefined)
        : undefined;
      setSuggestions(body?.details?.suggestions ?? []);
      toast.error(body?.message ?? 'Failed to add item');
    },
  });

  return { ...mutation, suggestions, clearSuggestions: () => setSuggestions([]) };
}

/** PO names that look like they belong to this item, ranked by the backend's matcher. */
export function usePurchaseAliasSuggestions(id: string | null) {
  return useQuery({
    queryKey: ['purchase-alias-suggestions', id],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<string[]>>(`/class-a-items/${id}/purchase-aliases/suggestions`)).data.data,
    enabled: Boolean(id),
  });
}

export function useSetPurchaseAliases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, purchaseAliases }: { id: string; purchaseAliases: string[]; brand: string }) =>
      apiClient.put(`/class-a-items/${id}/purchase-aliases`, { purchaseAliases }),
    onSuccess: (_data, input) => {
      toast.success('Purchase names updated');
      qc.invalidateQueries({ queryKey: ['class-a-items', input.brand] });
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error) => {
      const body = axios.isAxiosError(error) ? (error.response?.data as { message?: string } | undefined) : undefined;
      toast.error(body?.message ?? 'Failed to update purchase names');
    },
  });
}

export function useRemoveClassAItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; brand: string }) => apiClient.delete(`/class-a-items/${id}`),
    onSuccess: (_data, input) => {
      toast.success('Removed from Class A items');
      qc.invalidateQueries({ queryKey: ['class-a-items', input.brand] });
      qc.invalidateQueries({ queryKey: ['class-a-items-summary'] });
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: () => toast.error('Failed to remove item'),
  });
}
