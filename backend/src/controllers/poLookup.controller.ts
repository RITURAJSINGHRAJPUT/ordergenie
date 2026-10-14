import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { getPoLookup } from '../services/purchase/poLookup.service';
import { toPoLookupPdf } from '../utils/exporters';

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export const poLookupHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = querySchema.parse(req.query);
  return ok(res, await getPoLookup(date));
});

/** The same day as a printable prep sheet, for the kitchen wall rather than a screen. */
export const poLookupPdfHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = querySchema.parse(req.query);
  const cities = await getPoLookup(date);
  const day = date ?? new Date().toISOString().slice(0, 10);
  const pdf = await toPoLookupPdf(day, cities);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="po-lookup-${day}.pdf"`);
  return res.send(pdf);
});
