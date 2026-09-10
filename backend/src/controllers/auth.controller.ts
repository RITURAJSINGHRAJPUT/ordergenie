import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { login } from '../services/auth/auth.service';
import { prisma } from '../config/db';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, rememberMe } = loginSchema.parse(req.body);
  const result = await login(email, password, rememberMe);
  return ok(res, result);
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { role: true, outlet: true },
  });
  return ok(res, {
    id: user!.id,
    email: user!.email,
    name: user!.name,
    role: user!.role.name,
    outletId: user!.outletId,
    outletName: user!.outlet?.name ?? null,
    brand: user!.brand,
    pageGrants: user!.pageGrants,
  });
});
