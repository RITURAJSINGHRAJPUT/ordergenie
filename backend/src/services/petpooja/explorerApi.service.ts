import axios from 'axios';
import { env } from '../../config/env';
import { formatDateDDMMYYYY, formatDateYYYYMMDD } from '../../utils/dateRange';
import { petpoojaRequest } from './client';
import type { PetpoojaCredentials, PetpoojaOrderRecord, PetpoojaOrdersResponse } from './types';

// Nothing in this file is wired into the production sync pipeline — it exists only
// for the admin-only API Explorer (Settings), which is deliberately RAW/transparent:
// it sends exactly the date the user picked with no convenience offsetting, unlike
// salesApi.service.ts's fetchOrdersForDate (which adds +1 day internally so that
// calling it with day X returns real data FOR day X, per our production sync's own
// abstraction). The Explorer intentionally does NOT hide Petpooja's T-1 quirk from
// the user — its own hint text says so ("enter today's date to get yesterday's
// orders"), so this raw fetch must send the literal picked date, not an offset one.
const ORDERS_MAX_PAGES = 20;

export async function fetchOrdersRaw(
  credentials: PetpoojaCredentials,
  restID: string,
  literalDate: Date,
  onRequest?: () => void
): Promise<PetpoojaOrderRecord[]> {
  const orderDate = formatDateYYYYMMDD(literalDate);
  const allOrders: PetpoojaOrderRecord[] = [];
  const seenOrderIds = new Set<string>();
  let refId = '';

  for (let page = 0; page < ORDERS_MAX_PAGES; page++) {
    const response = await petpoojaRequest<PetpoojaOrdersResponse>({
      url: env.PETPOOJA_SALES_BASE_URL,
      method: 'POST',
      cookie: credentials.cookie,
      onRequest,
      body: {
        app_key: credentials.appKey,
        app_secret: credentials.appSecret,
        access_token: credentials.accessToken,
        restID,
        order_date: orderDate,
        refId,
      },
    });

    const orders = response.order_json ?? [];
    if (orders.length === 0) break;

    const newOrders = orders.filter((o) => !seenOrderIds.has(o.Order.orderID));
    if (newOrders.length === 0) break;

    newOrders.forEach((o) => seenOrderIds.add(o.Order.orderID));
    allOrders.push(...newOrders);

    const lastRefId = orders[orders.length - 1]?.Order?.refId;
    if (!lastRefId) break;
    refId = lastRefId;
  }

  return allOrders;
}

// Petpooja's own reference material claims a get_transfer/ endpoint exists, but a
// live call returns the same generic error as a made-up URL, so this function
// deliberately does NOT throw on failure: it surfaces whatever the API actually
// says, letting the Explorer UI show the truth instead of hiding it.
const TRANSFER_URL = 'https://api.petpooja.com/V1/thirdparty/get_transfer/';
const TIMEOUT_MS = 20_000;

export interface TransferRawResult {
  success: boolean;
  message?: string;
  errorCode?: string;
  records: unknown[];
}

export async function fetchTransfersRaw(
  credentials: PetpoojaCredentials,
  restID: string,
  fromDate: Date,
  toDate: Date
): Promise<TransferRawResult> {
  try {
    const res = await axios.post(
      TRANSFER_URL,
      {
        app_key: credentials.appKey,
        app_secret: credentials.appSecret,
        access_token: credentials.accessToken,
        restID,
        from_date: formatDateDDMMYYYY(fromDate),
        to_date: formatDateDDMMYYYY(toDate),
        refId: '',
      },
      { timeout: TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
    );

    const data = res.data ?? {};
    const isSuccess = data.success === '1' || data.success === 1;
    const records = Array.isArray(data.transfers) ? data.transfers : Array.isArray(data.data) ? data.data : [];

    return {
      success: isSuccess,
      message: data.message,
      errorCode: data.errorCode,
      records,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        message: err.response?.data?.message ?? err.message,
        errorCode: err.response?.data?.errorCode ?? String(err.response?.status ?? 'NETWORK_ERROR'),
        records: [],
      };
    }
    return { success: false, message: err instanceof Error ? err.message : String(err), records: [] };
  }
}
