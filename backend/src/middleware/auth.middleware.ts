import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/apiResponse';
import type { AuthUser } from '../types/express';

/**
 * The caller behind a request, or null if there isn't a valid one.
 *
 * Separate from verifyJwt because restrictedRoleGuard runs in front of the whole API — before any
 * router has authenticated anything — and needs to know the role without deciding, there and then,
 * whether a missing token is an error. That judgement stays with verifyJwt.
 */
export function decodeBearer(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  try {
    return jwt.verify(header.slice('Bearer '.length), env.JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function verifyJwt(req: Request, _res: Response, next: NextFunction) {
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    throw new AppError('Missing or invalid Authorization header', 401);
  }

  const payload = decodeBearer(req);
  if (!payload) throw new AppError('Invalid or expired token', 401);

  req.user = payload;
  next();
}
