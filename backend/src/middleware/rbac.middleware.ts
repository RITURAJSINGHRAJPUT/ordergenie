import type { NextFunction, Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { AppError } from '../utils/apiResponse';

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
