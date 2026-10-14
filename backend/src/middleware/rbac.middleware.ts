import type { NextFunction, Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { AppError } from '../utils/apiResponse';
import { decodeBearer } from './auth.middleware';

export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }
    next();
  };
}

/**
 * Forces the outlet filter to the caller's assigned outlet for OUTLET_MANAGER and
 * HEAD_CHEF, regardless of any outletId query param they send. ADMIN/MANAGEMENT
 * are unrestricted.
 */
export function scopeToOutlet(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new AppError('Not authenticated', 401);

  if (req.user.role === RoleName.OUTLET_MANAGER || req.user.role === RoleName.HEAD_CHEF) {
    if (!req.user.outletId) {
      throw new AppError('This account has no assigned outlet', 403);
    }
    req.query.outletId = req.user.outletId;
  }
  next();
}

/**
 * Forces the brand filter to the caller's assigned brand, overwriting whatever the client
 * sent — the brand twin of scopeToOutlet. Users with no brand (the default) are unrestricted.
 *
 * Brand scope is coarser than outlet scope and they compose: a user with an outlet is already
 * pinned to one outlet, so this only bites for brand-scoped users whose outletId is null.
 */
export function scopeToBrand(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new AppError('Not authenticated', 401);
  if (req.user.brand) {
    req.query.brand = req.user.brand;
  }
  next();
}

/** The one page that can be granted per-user today. */
export const SALES_FORECAST_GRANT = 'sales-forecast';

/**
 * Lets SUPER_ADMIN through, plus anyone explicitly granted the page. This is what makes a
 * granted page actually load — a nav-only grant would show the menu item and then 403.
 */
export function requirePageGrant(grant: string, ...alsoAllow: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const allowed =
      req.user.role === RoleName.SUPER_ADMIN ||
      alsoAllow.includes(req.user.role) ||
      (req.user.pageGrants ?? []).includes(grant);
    if (!allowed) throw new AppError('You do not have permission to perform this action', 403);
    next();
  };
}

/**
 * Roles that may only reach an explicit set of paths, keyed by API path prefix.
 *
 * Deny-by-default, because the opposite doesn't hold: several routers apply no `requireRole` at
 * all (dashboard, outlets, reconciliation, sold-out, notifications), so a role is otherwise
 * admitted to them simply by existing. Listing what a narrow role *can* reach means the next
 * route added is denied until someone decides otherwise, rather than silently handed over.
 *
 * Roles absent from this map are unaffected and keep their per-router guards.
 */
const RESTRICTED_ROLE_PATHS: Partial<Record<RoleName, string[]>> = {
  // The prep kitchen gets its prep list, and /auth so the session can resolve and sign out.
  [RoleName.PREP_KITCHEN]: ['/api/auth', '/api/po-lookup'],
};

export function restrictedRoleGuard(req: Request, _res: Response, next: NextFunction) {
  // Reads the token directly: this runs in front of the API, before any router's verifyJwt has
  // populated req.user. An absent or invalid token is left for verifyJwt to reject as a 401.
  const user = req.user ?? decodeBearer(req);
  const allowed = user && RESTRICTED_ROLE_PATHS[user.role];
  if (!allowed) return next();

  const path = req.baseUrl + req.path;
  if (allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return next();

  throw new AppError('You do not have permission to perform this action', 403);
}
