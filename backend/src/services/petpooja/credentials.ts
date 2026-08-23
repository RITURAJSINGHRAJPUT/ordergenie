import { ApiType } from '@prisma/client';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { decrypt } from '../../utils/encryption';
import type { PetpoojaCredentials } from './types';

const ENV_FALLBACKS: Partial<Record<ApiType, PetpoojaCredentials>> = {
  SALES: {
    appKey: env.PETPOOJA_SALES_APP_KEY,
    appSecret: env.PETPOOJA_SALES_APP_SECRET,
    accessToken: env.PETPOOJA_SALES_ACCESS_TOKEN,
    cookie: env.PETPOOJA_SALES_COOKIE,
  },
  PURCHASE: {
    appKey: env.PETPOOJA_PURCHASE_APP_KEY,
    appSecret: env.PETPOOJA_PURCHASE_APP_SECRET,
    accessToken: env.PETPOOJA_PURCHASE_ACCESS_TOKEN,
  },
};

export async function resolveCredentials(apiType: ApiType): Promise<PetpoojaCredentials | null> {
  const row = await prisma.petpoojaApiConfig.findUnique({ where: { apiType } });

  if (row?.appKeyEncrypted && row.appSecretEncrypted && row.accessTokenEncrypted) {
    return {
      appKey: decrypt(row.appKeyEncrypted),
      appSecret: decrypt(row.appSecretEncrypted),
      accessToken: decrypt(row.accessTokenEncrypted),
      cookie: row.cookieEncrypted ? decrypt(row.cookieEncrypted) : undefined,
    };
  }

  const fallback = ENV_FALLBACKS[apiType];
  if (fallback && fallback.appKey && fallback.appSecret && fallback.accessToken) {
    return fallback;
  }

  return null;
}

/**
 * Inbound PO webhook verification (purchaseOrderWebhook.service.ts) only needs to
 * confirm app_secret against a shared secret — unlike resolveCredentials's callers,
 * which place real outbound Petpooja API calls and genuinely need app_key/app_secret/
 * access_token together. Gating this on all three being saved (resolveCredentials'
 * requirement) meant a config row with only app_secret filled in — the realistic
 * state here, since access_token isn't reliably available for this integration —
 * returned null and every webhook 401'd regardless of the app_secret check. This
 * reads app_secret/access_token independently so either one being saved is enough.
 */
export async function resolveWebhookSecrets(apiType: ApiType): Promise<string[]> {
  const row = await prisma.petpoojaApiConfig.findUnique({ where: { apiType } });
  const stored = [row?.appSecretEncrypted, row?.accessTokenEncrypted]
    .filter((v): v is string => Boolean(v))
    .map((v) => decrypt(v));
  if (stored.length) return stored;

  const fallback = ENV_FALLBACKS[apiType];
  return [fallback?.appSecret, fallback?.accessToken].filter((v): v is string => Boolean(v));
}
