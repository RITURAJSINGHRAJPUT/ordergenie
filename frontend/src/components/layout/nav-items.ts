import type { LucideIcon } from 'lucide-react';
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
  Trash2,
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
  /** Presence of `children` renders this as a collapsible section instead of a direct link. */
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Capiche',
    icon: Building2,
    children: [
      { label: 'Reconciliation', href: '/capiche/reconciliation', icon: Scale },
      { label: 'Predictions', href: '/capiche/predictions', icon: TrendingUp },
      { label: 'Purchase Orders', href: '/capiche/purchase-orders', icon: ClipboardList },
      { label: 'Class A Items', href: '/capiche/class-a-items', icon: Star },
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
    children: [
      { label: 'Reconciliation', href: '/aiko/reconciliation', icon: Scale },
      { label: 'Predictions', href: '/aiko/predictions', icon: TrendingUp },
      { label: 'Purchase Orders', href: '/aiko/purchase-orders', icon: ClipboardList },
      { label: 'Class A Items', href: '/aiko/class-a-items', icon: Star },
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
  { label: 'Outlets', href: '/outlets', icon: Store },
  { label: 'Reports', href: '/reports', icon: FileBarChart },
  { label: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
];

const HEAD_CHEF_LABELS = new Set(['Reconciliation', 'Sold Out']);

/**
 * Head Chef is a narrow role — everything except Dashboard and each brand
 * section's daily-entry pages (Reconciliation, Sold Out) is hidden (the
 * backend also 403s those routes; this is just the matching nav view, an
 * allowlist rather than a per-item flag so a newly added nav item defaults
 * to hidden from this role).
 */
export function filterForHeadChef(items: NavItem[]): NavItem[] {
  return items
    .filter((item) => item.href === '/dashboard' || item.children)
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((child) => HEAD_CHEF_LABELS.has(child.label)) }
        : item
    );
}
