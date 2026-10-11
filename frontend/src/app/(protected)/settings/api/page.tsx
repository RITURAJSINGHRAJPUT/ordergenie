'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiConfigs, useUpdateApiConfig } from '@/hooks/useSettings';
import { useAuthStore } from '@/store/authStore';
import type { ApiConfigRow, ApiType } from '@/types/api';

const API_LABELS: Record<ApiType, { label: string; description: string }> = {
  SALES: { label: 'Sales / Orders API', description: 'generic_get_orders — synced every 5 minutes.' },
  PURCHASE: { label: 'Purchase API', description: 'get_purchase — synced every 15 minutes.' },
  INVENTORY: { label: 'Inventory (Stock) API', description: 'Not yet documented by Petpooja — runs as a stub.' },
  TRANSFER: { label: 'Inventory Transfer API', description: 'Not yet documented by Petpooja — runs as a stub.' },
};

export default function ApiConfigPage() {
  const { data, isLoading, isError } = useApiConfigs();
  const [editing, setEditing] = useState<ApiConfigRow | null>(null);
  const isViewer = useAuthStore((s) => s.user)?.role === 'VIEWER';

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Failed to load API configuration.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.map((cfg) => (
          <Card key={cfg.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{API_LABELS[cfg.apiType].label}</CardTitle>
                <Badge variant={cfg.isConfigured ? 'secondary' : 'outline'}>
                  {cfg.isConfigured ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              <CardDescription>{API_LABELS[cfg.apiType].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">App Key</span>
                <span className="font-mono">{cfg.appKeyMasked ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Token</span>
                <span className="font-mono">{cfg.accessTokenMasked ?? '—'}</span>
              </div>
              {cfg.notes && <p className="text-xs text-muted-foreground">{cfg.notes}</p>}
              {!isViewer && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditing(cfg)}>
                  Edit Credentials
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ApiConfigEditDialog config={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ApiConfigEditDialog({ config, onClose }: { config: ApiConfigRow | null; onClose: () => void }) {
  const update = useUpdateApiConfig();
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [cookie, setCookie] = useState('');
  const [notes, setNotes] = useState(config?.notes ?? '');

  return (
    <Dialog
      open={Boolean(config)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setAppKey('');
          setAppSecret('');
          setAccessToken('');
          setCookie('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config && API_LABELS[config.apiType].label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Leave a field blank to keep its current value. New values are encrypted at rest.
          </p>
          <div className="space-y-1">
            <Label htmlFor="appKey">App Key</Label>
            <Input id="appKey" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="Unchanged" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="appSecret">App Secret</Label>
            <Input id="appSecret" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="Unchanged" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="accessToken">Access Token</Label>
            <Input id="accessToken" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Unchanged" />
          </div>
          {config?.apiType === 'SALES' && (
            <div className="space-y-1">
              <Label htmlFor="cookie">Cookie</Label>
              <Input id="cookie" value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="Unchanged" />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={update.isPending}
            onClick={() => {
              if (!config) return;
              update.mutate(
                {
                  apiType: config.apiType,
                  ...(appKey ? { appKey } : {}),
                  ...(appSecret ? { appSecret } : {}),
                  ...(accessToken ? { accessToken } : {}),
                  ...(cookie ? { cookie } : {}),
                  notes,
                },
                { onSuccess: onClose }
              );
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
