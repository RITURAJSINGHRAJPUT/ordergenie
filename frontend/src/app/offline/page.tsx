import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Offline — OrderGenie' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <WifiOff className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        OrderGenie couldn&apos;t reach the network. Check your connection and try again — pages you&apos;ve already
        visited may still be available from cache.
      </p>
    </div>
  );
}
