import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, AppError } from '../utils/apiResponse';
import { getPoLookup } from '../services/purchase/poLookup.service';
import { toPoLookupPdf } from '../utils/exporters';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** PDF only: one city's sheet instead of every city. */
  city: z.string().min(1).optional(),
});

export const poLookupHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = querySchema.parse(req.query);
  return ok(res, await getPoLookup(date));
});

/**
 * The same day as a printable prep sheet, for the kitchen wall rather than a screen. With `city`
 * it prints that one kitchen's sheet, since Surat's prep team has no use for Ahmedabad's numbers.
 */
export const poLookupPdfHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date, city } = querySchema.parse(req.query);
  const all = await getPoLookup(date);
  const cities = city ? all.filter((c) => c.city.toLowerCase() === city.toLowerCase()) : all;
  if (city && cities.length === 0) throw new AppError(`No outlets found for "${city}"`, 404);

  const day = date ?? new Date().toISOString().slice(0, 10);
  const pdf = await toPoLookupPdf(day, cities);
  const name = city ? `po-lookup-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${day}` : `po-lookup-${day}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
  return res.send(pdf);
});
