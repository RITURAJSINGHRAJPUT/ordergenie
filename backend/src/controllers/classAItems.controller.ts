import type { Request, Response } from 'express';
import { z } from 'zod';
import { ClassAItemType } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created, AppError } from '../utils/apiResponse';
import {
  listClassAItems,
  addClassAItem,
  removeClassAItem,
  getClassAItemsSummary,
  setPurchaseAliases,
  suggestPurchaseAliases,
} from '../services/classAItems/classAItems.service';

const addSchema = z.object({
  brand: z.string().min(1),
  type: z.nativeEnum(ClassAItemType),
  value: z.string().min(1),
});

export const listClassAItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
  if (!brand) throw new AppError('brand is required', 400);
  const items = await listClassAItems(brand);
  return ok(res, items);
});

export const addClassAItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = addSchema.parse(req.body);
  const item = await addClassAItem(input.brand, input.type, input.value);
  return created(res, item);
});

const aliasesSchema = z.object({ purchaseAliases: z.array(z.string()) });

export const setPurchaseAliasesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { purchaseAliases } = aliasesSchema.parse(req.body);
  const item = await setPurchaseAliases(req.params.id, purchaseAliases);
  return ok(res, item);
});

export const suggestPurchaseAliasesHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await suggestPurchaseAliases(req.params.id));
});

export const removeClassAItemHandler = asyncHandler(async (req: Request, res: Response) => {
  await removeClassAItem(req.params.id);
  return ok(res, { removed: true });
});

export const getClassAItemsSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
  if (!brand) throw new AppError('brand is required', 400);
  const rows = await getClassAItemsSummary({ brand, ...(req.query as Record<string, string>) });
  return ok(res, rows);
});
