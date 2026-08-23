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
