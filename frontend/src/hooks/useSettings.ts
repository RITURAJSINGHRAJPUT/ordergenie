import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type {
  ApiConfigRow,
  ApiEnvelope,
  ApiType,
  NotificationSettings,
  RoleRow,
  SyncScheduleRow,
  SyncType,
  UserRow,
} from '@/types/api';

export function useApiConfigs() {
  return useQuery({
    queryKey: ['settings', 'api-config'],
    queryFn: async () => (await apiClient.get<ApiEnvelope<ApiConfigRow[]>>('/settings/api-config')).data.data,
  });
}

export function useUpdateApiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ apiType, ...input }: { apiType: ApiType; appKey?: string; appSecret?: string; accessToken?: string; cookie?: string; notes?: string }) =>
      apiClient.put(`/settings/api-config/${apiType}`, input),
    onSuccess: () => {
      toast.success('API configuration updated');
      qc.invalidateQueries({ queryKey: ['settings', 'api-config'] });
    },
    onError: () => toast.error('Failed to update API configuration'),
  });
}

export function useSyncSchedules() {
  return useQuery({
    queryKey: ['settings', 'sync-schedule'],
    queryFn: async () => (await apiClient.get<ApiEnvelope<SyncScheduleRow[]>>('/settings/sync-schedule')).data.data,
  });
}

export function useUpdateSyncSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ syncType, ...input }: { syncType: SyncType; cronExpression?: string; isEnabled?: boolean }) =>
      apiClient.put(`/settings/sync-schedule/${syncType}`, input),
    onSuccess: () => {
      toast.success('Sync schedule updated');
      qc.invalidateQueries({ queryKey: ['settings', 'sync-schedule'] });
    },
    onError: () => toast.error('Failed to update sync schedule'),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['settings', 'users'],
    queryFn: async () => (await apiClient.get<ApiEnvelope<UserRow[]>>('/settings/users')).data.data,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string; roleId: string; outletId?: string }) =>
      apiClient.post('/settings/users', input),
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: () => toast.error('Failed to create user'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      email?: string;
      roleId?: string;
      outletId?: string | null;
      isActive?: boolean;
      password?: string;
    }) => apiClient.put(`/settings/users/${id}`, input),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: () => toast.error('Failed to update user'),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/settings/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['settings', 'users'] });
    },
    onError: () => toast.error('Failed to delete user'),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: async () => (await apiClient.get<ApiEnvelope<RoleRow[]>>('/settings/roles')).data.data,
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) =>
      apiClient.put(`/settings/roles/${id}`, { description }),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['settings', 'roles'] });
    },
    onError: () => toast.error('Failed to update role'),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: async () => (await apiClient.get<ApiEnvelope<NotificationSettings>>('/settings/notifications')).data.data,
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NotificationSettings>) => apiClient.put('/settings/notifications', input),
    onSuccess: () => {
      toast.success('Notification preferences saved');
      qc.invalidateQueries({ queryKey: ['settings', 'notifications'] });
    },
    onError: () => toast.error('Failed to save notification preferences'),
  });
}
