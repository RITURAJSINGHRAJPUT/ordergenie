import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4101),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REMEMBER_EXPIRES_IN: z.string().default('30d'),

  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),

  PETPOOJA_SALES_BASE_URL: z.string().default('https://api.petpooja.com/V1/thirdparty/generic_get_orders/'),
  PETPOOJA_SALES_APP_KEY: z.string().default(''),
  PETPOOJA_SALES_APP_SECRET: z.string().default(''),
  PETPOOJA_SALES_ACCESS_TOKEN: z.string().default(''),
  PETPOOJA_SALES_COOKIE: z.string().default(''),

  PETPOOJA_PURCHASE_BASE_URL: z.string().default('https://api.petpooja.com/V1/thirdparty/get_purchase/'),
  PETPOOJA_PURCHASE_APP_KEY: z.string().default(''),
  PETPOOJA_PURCHASE_APP_SECRET: z.string().default(''),
  PETPOOJA_PURCHASE_ACCESS_TOKEN: z.string().default(''),

  ENABLE_STUB_DATA: z.coerce.boolean().default(true),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@ordergenie.local'),
  SEED_ADMIN_PASSWORD: z.string().min(6).default('ChangeMe123!'),
});

export const env = envSchema.parse(process.env);
