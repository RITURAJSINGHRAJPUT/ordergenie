'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { usePurchaseOrderWebhookLogDetail } from '@/hooks/usePurchaseOrderWebhookLogs';
import { formatDate, formatTime } from '@/lib/format';

export function WebhookLogDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = usePurchaseOrderWebhookLogDetail(id);

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{data?.poNumber ?? 'Webhook Delivery'}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Received At</div>
                <div className="font-medium">
                  {formatDate(data.receivedAt)} {formatTime(data.receivedAt)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Outlet</div>
                <div className="font-medium">{data.outletName ?? 'Unresolved'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Outcome</div>
                <Badge variant={data.outcome === 'SUCCESS' ? 'secondary' : 'destructive'}>{data.outcome}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">HTTP Status</div>
                <div className="font-medium">{data.httpStatusCode}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Petpooja Purchase ID</div>
                <div className="font-medium">{data.petpoojaPurchaseId ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Menu Sharing Code</div>
                <div className="font-medium">{data.menuSharingCode ?? '—'}</div>
              </div>
              {data.failureReason && (
                <div className="col-span-2 sm:col-span-3">
                  <div className="text-muted-foreground">Failure Reason</div>
                  <div className="font-medium text-destructive">{data.failureReason}</div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Current Purchase Order state</div>
              {!data.currentPurchaseOrder ? (
                <p className="text-sm text-muted-foreground">No linked Purchase Order.</p>
              ) : 'pruned' in data.currentPurchaseOrder ? (
                <p className="text-sm text-muted-foreground">
                  Purchase Order <code className="text-xs">{data.currentPurchaseOrder.id}</code> was pruned by
                  retention cleanup and no longer exists.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">PO #</div>
                    <div className="font-medium">{data.currentPurchaseOrder.poNumber}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Current Status</div>
                    <div className="font-medium">{data.currentPurchaseOrder.status.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Updated</div>
                    <div className="font-medium">{formatDate(data.currentPurchaseOrder.updatedAt)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Raw Payload (credentials redacted)</div>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(data.rawPayload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
