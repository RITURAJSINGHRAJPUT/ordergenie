import { useOutlets } from '@/hooks/useOutlets';
import { useAuthStore } from '@/store/authStore';
import { visibleNavItems, type NavItem } from '@/components/layout/nav-items';

const OUTLET_SCOPED_ROLES = new Set(['HEAD_CHEF', 'OUTLET_MANAGER']);

/**
 * The nav items the signed-in user may see, plus whether that answer is settled yet.
 *
 * Allowed brands are derived from `GET /outlets`, which the backend already scopes to the
 * caller's assigned outlet for HEAD_CHEF/OUTLET_MANAGER — so a Capiche head chef simply has
 * no Aiko outlet and loses the Aiko section. Reading it from the outlets list rather than the
 * auth payload means already-signed-in sessions (whose persisted user object predates this)
 * are correct without re-logging in.
 *
 * `isReady` is false while that lookup is in flight for a scoped role, so callers can hold off
 * on redirecting rather than bouncing a page they'd have allowed a moment later.
 */
export function useVisibleNav(): { items: NavItem[]; isReady: boolean } {
  const role = useAuthStore((s) => s.user)?.role;
  const isOutletScoped = role !== undefined && OUTLET_SCOPED_ROLES.has(role);
  const { data: outlets } = useOutlets();

  // Unrestricted roles don't wait on the query at all — their nav never flickers.
  if (!isOutletScoped) {
    return { items: visibleNavItems({ role, allowedBrands: null }), isReady: role !== undefined };
  }

  const allowedBrands = outlets ? Array.from(new Set(outlets.map((o) => o.brand))) : [];
  return { items: visibleNavItems({ role, allowedBrands }), isReady: Boolean(outlets) };
}
