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

// Keyed by brand + item name rather than a ClassAItem id: a reconciliation row can come
// from a CATEGORY expansion and have no ClassAItem of its own.
const aliasesSchema = z.object({
  brand: z.string().min(1),
  itemName: z.string().min(1),
  purchaseAliases: z.array(z.string()),
});

export const setPurchaseAliasesHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = aliasesSchema.parse(req.body);
  return ok(res, await setPurchaseAliases(input.brand, input.itemName, input.purchaseAliases));
});

export const suggestPurchaseAliasesHandler = asyncHandler(async (req: Request, res: Response) => {
  const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
  const itemName = typeof req.query.itemName === 'string' ? req.query.itemName : undefined;
  if (!brand || !itemName) throw new AppError('brand and itemName are required', 400);
  return ok(res, await suggestPurchaseAliases(brand, itemName));
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
