import { LoginMarketingPanel } from '@/components/auth/LoginMarketingPanel';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden lg:flex">
        <LoginMarketingPanel />
      </div>
      {/* Full-bleed under viewport-fit=cover, so the padding grows to clear the notch / home indicator. */}
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-background pt-[max(3rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(3rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
        {children}
      </div>
    </div>
  );
}
