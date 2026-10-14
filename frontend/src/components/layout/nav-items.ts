import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/types/api';
import {
  LayoutDashboard,
  Receipt,
  UtensilsCrossed,
  Boxes,
  ClipboardList,
  Store,
  FileBarChart,
  Settings,
  ChefHat,
  Building2,
  Webhook,
  Star,
  Sigma,
  Trash2,
  ClipboardCheck,
  Scale,
  TrendingUp,
  PackageX,
} from 'lucide-react';

export interface NavItem {
  label: string;
  /** Leaf items link here. Section items (with `children`) omit this — the header only toggles. */
  href?: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Brand this section belongs to — set on brand sections so access can key off it, not the label. */
  brand?: string;
  /** Presence of `children` renders this as a collapsible section instead of a direct link. */
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Capiche',
    icon: Building2,
    brand: 'Capiche',
    children: [
      { label: 'Reconciliation', href: '/capiche/reconciliation', icon: Scale },
      { label: 'Predictions', href: '/capiche/predictions', icon: TrendingUp },
      { label: 'Purchase Orders', href: '/capiche/purchase-orders', icon: ClipboardList },
      { label: 'Class A Items', href: '/capiche/class-a-items', icon: Star },
      { label: 'Class B Items', href: '/capiche/class-b-items', icon: Sigma },
      { label: 'Sold Out', href: '/capiche/sold-out', icon: PackageX },
      { label: 'Overview', href: '/capiche/overview', icon: LayoutDashboard },
      { label: 'Sales', href: '/capiche/sales', icon: Receipt },
      { label: 'Inventory', href: '/capiche/inventory', icon: Boxes },
      { label: 'Wastage Management', href: '/capiche/wastage-management', icon: Trash2 },
      { label: 'Sales API', href: '/capiche/sales-api', icon: Webhook, adminOnly: true },
    ],
  },
  {
    label: 'Aiko',
    icon: ChefHat,
    brand: 'Aiko',
    children: [
      { label: 'Reconciliation', href: '/aiko/reconciliation', icon: Scale },
      { label: 'Predictions', href: '/aiko/predictions', icon: TrendingUp },
      { label: 'Purchase Orders', href: '/aiko/purchase-orders', icon: ClipboardList },
      { label: 'Class A Items', href: '/aiko/class-a-items', icon: Star },
      { label: 'Class B Items', href: '/aiko/class-b-items', icon: Sigma },
      { label: 'Sold Out', href: '/aiko/sold-out', icon: PackageX },
      { label: 'Overview', href: '/aiko/overview', icon: LayoutDashboard },
      { label: 'Sales', href: '/aiko/sales', icon: Receipt },
      { label: 'Inventory', href: '/aiko/inventory', icon: Boxes },
      { label: 'Wastage Management', href: '/aiko/wastage-management', icon: Trash2 },
      { label: 'Sales API', href: '/aiko/sales-api', icon: Webhook, adminOnly: true },
    ],
  },
  { label: 'Sales', href: '/sales', icon: Receipt },
  { label: 'Item Sales', href: '/item-sales', icon: UtensilsCrossed },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardList },
  { label: 'PO Lookup', href: '/po-lookup', icon: ClipboardCheck },
  { label: 'Outlets', href: '/outlets', icon: Store },
  { label: 'Reports', href: '/reports', icon: FileBarChart },
  { label: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
];

const HEAD_CHEF_LABELS = new Set(['Reconciliation', 'Sold Out', 'Wastage Management']);

/**
 * Roles narrow enough to be described by what they *may* see rather than what they may not.
 *
 * `top` is the top-level labels; `children` the brand-section pages (absent = no brand sections).
 * An allowlist, so a nav item added later is hidden from these roles until someone decides it
 * shouldn't be — the opposite of the default below, which hands any unlisted role the full nav.
 */
const RESTRICTED_ROLE_NAV: Partial<Record<Role, { top: Set<string>; children?: Set<string> }>> = {
  HEAD_CHEF: { top: new Set(['Dashboard', 'PO Lookup']), children: HEAD_CHEF_LABELS },
  PREP_KITCHEN: { top: new Set(['PO Lookup']) },
};

/** Where a role lands after signing in: the first page it is actually allowed to open. */
export function landingPathFor(role: Role | undefined): string {
  return role === 'PREP_KITCHEN' ? '/po-lookup' : '/dashboard';
}

/** Narrows the nav to the labels a restricted role may see, sections and children alike. */
function filterForRestrictedRole(items: NavItem[], allowed: { top: Set<string>; children?: Set<string> }): NavItem[] {
  return items
    .filter((item) => (item.href ? allowed.top.has(item.label) : Boolean(item.children) && Boolean(allowed.children)))
    .map((item) =>
      item.children && allowed.children
        ? { ...item, children: item.children.filter((child) => allowed.children!.has(child.label)) }
        : item
    );
}

/**
 * The nav a given user is allowed to see. Single source of truth for both the
 * sidebar and the route guard in the protected layout, so what's reachable by
 * URL can't drift from what's listed in the nav.
 *
 * `allowedBrands` of `null` means unrestricted (ADMIN/MANAGEMENT/VIEWER see every
 * outlet). Outlet-scoped roles pass the brands of the outlets the API returns for
 * them, which hides the other brand's section entirely.
 */
export function visibleNavItems({
  role,
  allowedBrands,
  pageGrants = [],
}: {
  role?: Role;
  allowedBrands: string[] | null;
  pageGrants?: string[];
}): NavItem[] {
  // adminOnly means "admin tier" — SUPER_ADMIN inherits everything ADMIN can see.
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isViewer = role === 'VIEWER';
  // Settings itself is SUPER_ADMIN-only now, except VIEWER's long-standing read-only tabs and
  // anyone holding a page grant, who needs the entry point to reach their one tab.
  const canOpenSettings = role === 'SUPER_ADMIN' || isViewer || pageGrants.length > 0;
  const restricted = role ? RESTRICTED_ROLE_NAV[role] : undefined;
  const base = restricted ? filterForRestrictedRole(NAV_ITEMS, restricted) : NAV_ITEMS;

  return base
    .filter((item) => !item.brand || !allowedBrands || allowedBrands.includes(item.brand))
    // "Sales API" (brand-workspace children, adminOnly) stays admin-only — VIEWER only
    // gains visibility into "Settings" itself, which then further restricts its own
    // tabs (see settings/layout.tsx) down to Petpooja API + API Explorer.
    .filter((item) => (item.label === 'Settings' ? canOpenSettings : !item.adminOnly || isAdmin))
    .map((item) =>
      item.children ? { ...item, children: item.children.filter((child) => !child.adminOnly || isAdmin) } : item
    );
}

function allowedPaths(items: NavItem[]): { exact: string[]; prefix: string[] } {
  const exact: string[] = [];
  const prefix: string[] = [];

  for (const item of items) {
    // Leaf links cover their sub-pages too — /settings has to admit /settings/users.
    if (item.href) prefix.push(item.href);
    // A brand root (/capiche) is only a landing page that forwards to the first page the
    // user may open, so it matches exactly. Treating it as a prefix would hand over every
    // page under that brand, including the ones this role isn't allowed to see.
    if (item.brand) exact.push(`/${item.brand.toLowerCase()}`);
    for (const child of item.children ?? []) {
      if (child.href) prefix.push(child.href);
    }
  }

  return { exact, prefix };
}

/** Whether a path is reachable with the given nav — the routing half of the same allowlist. */
export function isRouteAllowed(pathname: string, items: NavItem[]): boolean {
  if (pathname === '/') return true;
  const { exact, prefix } = allowedPaths(items);
  return exact.includes(pathname) || prefix.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
