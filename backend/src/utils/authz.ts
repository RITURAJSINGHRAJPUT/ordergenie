import type { Request } from 'express';
import { RoleName } from '@prisma/client';
import { AppError } from './apiResponse';

/**
 * Returns the outletId a detail-by-id lookup must be restricted to, or undefined
 * if the caller isn't outlet-scoped. Used alongside scopeToOutlet (which only
 * rewrites list-query params) to also guard single-record :id lookups, which
 * bypass query filtering entirely.
 *
 * Throws the same 403 as scopeToOutlet when a scoped role has no outlet assigned,
 * rather than returning undefined — returning undefined here previously meant
 * "not restricted," which silently made :id lookups unscoped (see everything)
 * for a broken account instead of blocked, the opposite of how list routes
 * already behaved for the same condition.
 */
export function outletRestrictionFor(req: Request): string | undefined {
  if (req.user?.role === RoleName.OUTLET_MANAGER || req.user?.role === RoleName.HEAD_CHEF) {
    if (!req.user.outletId) {
      throw new AppError('This account has no assigned outlet', 403);
    }
    return req.user.outletId;
  }
  return undefined;
}

/**
 * The brand a detail-by-id lookup must be restricted to, or undefined when the caller isn't
 * brand-scoped. The brand counterpart of outletRestrictionFor — query filtering doesn't reach
 * `:id` routes, so those have to check the loaded record's brand themselves.
 */
export function brandRestrictionFor(req: Request): string | undefined {
  return req.user?.brand ?? undefined;
}
