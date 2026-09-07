import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { listPurchaseOrders, listPurchaseOrderItemsByDay, getPurchaseOrderById } from '../services/purchase/purchaseOrders.service';
import { outletRestrictionFor } from '../utils/authz';
import { toPurchaseOrderPdf } from '../utils/exporters';

export const listPurchaseOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listPurchaseOrders(req.query as Record<string, string>);
  return ok(res, rows, meta);
});

export const listPurchaseOrderItemsByDayHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await listPurchaseOrderItemsByDay(req.query as Record<string, string>);
  return ok(res, data);
});

export const getPurchaseOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getPurchaseOrderById(req.params.id, outletRestrictionFor(req));
  return ok(res, data);
});

// Same lookup as the detail endpoint — including its outlet restriction — just rendered
// as a document instead of JSON, so this exposes nothing GET /:id doesn't already.
export const getPurchaseOrderPdfHandler = asyncHandler(async (req: Request, res: Response) => {
  const po = await getPurchaseOrderById(req.params.id, outletRestrictionFor(req));
  const pdf = await toPurchaseOrderPdf(po);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${po.poNumber}.pdf"`);
  return res.send(pdf);
});
