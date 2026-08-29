import type { Request, Response } from 'express';
import { z } from 'zod';
import { WastageReason } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created } from '../utils/apiResponse';
import { outletRestrictionFor } from '../utils/authz';
import { listWastageEntries, createWastageEntry, deleteWastageEntry } from '../services/wastage/wastage.service';

const createSchema = z.object({
  outletId: z.string().min(1),
  itemName: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  reason: z.nativeEnum(WastageReason),
  notes: z.string().optional(),
});

export const listWastageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listWastageEntries(req.query as Record<string, string>);
  return ok(res, rows, meta);
});

export const createWastageHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createSchema.parse(req.body);
  // outletId arrives in the body, which scopeToOutlet doesn't touch (it only rewrites
  // query params) — without this an outlet-scoped caller could log wastage against any
  // outlet just by editing the payload.
  const restrictTo = outletRestrictionFor(req);
  const entry = await createWastageEntry({
    ...input,
    ...(restrictTo ? { outletId: restrictTo } : {}),
    reportedById: req.user?.id,
  });
  return created(res, entry);
});

export const deleteWastageHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteWastageEntry(req.params.id, outletRestrictionFor(req));
  return ok(res, { removed: true });
});
