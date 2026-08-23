import type { Request, Response } from 'express';
import { WebhookOutcome } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, AppError } from '../utils/apiResponse';
import { handlePurchaseOrderWebhook } from '../services/petpooja/purchaseOrderWebhook.service';
import { logPurchaseOrderWebhookCall } from '../services/petpooja/webhookLog.service';
import type { PetpoojaPurchaseOrderWebhookPayload } from '../services/petpooja/types';

export const purchaseOrderWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as Partial<PetpoojaPurchaseOrderWebhookPayload>;
  const logCtx = {
    rawPayload: req.body,
    petpoojaPurchaseId: payload?.data?.id ?? null,
    poNumber: payload?.data?.poNumber ?? null,
    menuSharingCode: payload?.data?.menuSharingCode ?? payload?.menuSharingCode ?? null,
  };

  try {
    if (!payload?.data?.id || !payload.data.poNumber) {
      throw new AppError('Malformed webhook payload', 400);
    }

    const result = await handlePurchaseOrderWebhook(payload as PetpoojaPurchaseOrderWebhookPayload);

    await logPurchaseOrderWebhookCall({
      ...logCtx,
      outcome: WebhookOutcome.SUCCESS,
      httpStatusCode: 200,
      outletId: result.outletId,
      purchaseOrderId: result.purchaseOrderId,
      status: result.status,
      writeResult: result.result,
    });

    // Petpooja only ever received {outletId, purchaseOrderId, result} here — `status`
    // was added to PurchaseOrderWebhookResult purely so this handler could log it
    // without a second DB read; strip it back out so the response body is unchanged.
    return ok(res, { outletId: result.outletId, purchaseOrderId: result.purchaseOrderId, result: result.result });
  } catch (err) {
    const httpStatusCode = err instanceof AppError ? err.statusCode : 500;
    const failureReason = err instanceof Error ? err.message : 'Unknown error';
    await logPurchaseOrderWebhookCall({ ...logCtx, outcome: WebhookOutcome.REJECTED, httpStatusCode, failureReason });
    throw err;
  }
});
