import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { getPoLookup } from '../services/purchase/poLookup.service';

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export const poLookupHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = querySchema.parse(req.query);
  return ok(res, await getPoLookup(date));
});
