import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, PaginationMeta, PredictionImportLogRow, PredictionImportResult, PredictionSummary } from '@/types/api';

export function usePredictionSummary() {
  return useQuery({
    queryKey: ['prediction-summary'],
    queryFn: async () => (await apiClient.get<ApiEnvelope<PredictionSummary>>('/predicted-sales/summary')).data.data,
  });
}

export function usePredictionImportLogs(page: number, pageSize = 12) {
  return useQuery({
    queryKey: ['prediction-import-logs', page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PredictionImportLogRow[]>>('/predicted-sales/import-logs', {
        params: { page, pageSize },
      });
      return { rows: res.data.data, meta: res.data.meta as PaginationMeta };
    },
  });
}

export function useImportPredictionWorkbook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<ApiEnvelope<PredictionImportResult>>('/predicted-sales/import', formData);
      return res.data.data;
    },
    onSuccess: (result) => {
      if (result.status === 'FAILED') {
        toast.error(result.errorMessage ?? 'Import failed');
      } else if (result.status === 'PARTIAL') {
        toast.warning(`Imported with ${result.sheetsSkipped.length} sheet(s) skipped — see details below`);
      } else {
        toast.success(`Imported ${result.rowsCreated + result.rowsUpdated} rows (${result.rowsCreated} new, ${result.rowsUpdated} updated)`);
      }
      qc.invalidateQueries({ queryKey: ['prediction-summary'] });
      qc.invalidateQueries({ queryKey: ['prediction-import-logs'] });
    },
    onError: () => toast.error('Failed to upload forecast file'),
  });
}
