import { env } from '../../config/env';
import { formatDateYYYYMMDD } from '../../utils/dateRange';
import { petpoojaRequest } from './client';
import type { PetpoojaCredentials, PetpoojaOrderRecord, PetpoojaOrdersResponse } from './types';

const MAX_PAGES = 20;

/**
 * Petpooja's generic_get_orders API returns the PREVIOUS day's data relative to
 * the `order_date` you send (their docs: sending 2026-06-04 returns 03-June data).
 * So to fetch orders for `targetDate`, we send targetDate + 1 day.
 *
 * Confirmed via a live call: the response is `{ code, success, message, order_json }`
 * — each element is `{ Restaurant, Customer, Order, Tax, Discount, OrderItem }`, not
 * the flat `orders`/`order_items` shape the docs summary implied. Pagination has no
 * documented page-size cap for this endpoint (unlike Purchase's 50/page); we loop
 * using the last order's `Order.refId` as the next request's `refId` and stop once a
 * page comes back empty, capped at MAX_PAGES as a safety backstop.
 */
export async function fetchOrdersForDate(
  credentials: PetpoojaCredentials,
  restID: string,
  targetDate: Date,
  onRequest?: () => void
): Promise<PetpoojaOrderRecord[]> {
  const apiDate = new Date(targetDate);
  apiDate.setDate(apiDate.getDate() + 1);
  const orderDate = formatDateYYYYMMDD(apiDate);

  const allOrders: PetpoojaOrderRecord[] = [];
  const seenOrderIds = new Set<string>();
  let refId = '';

  for (let page = 0; page < MAX_PAGES; page++) {
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

    // Safety net: it isn't confirmed whether `refId` actually pages results server-side
    // or the endpoint always returns the full day in one call. If a "next page" comes
    // back with only orders we've already seen, stop instead of looping MAX_PAGES times.
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
