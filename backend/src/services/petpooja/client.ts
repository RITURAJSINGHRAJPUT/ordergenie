import axios from 'axios';
import { logger } from '../../utils/logger';

const TIMEOUT_MS = 20_000;

export interface PetpoojaRequestOptions {
  url: string;
  method: 'GET' | 'POST';
  body: Record<string, unknown>;
  cookie?: string;
  /** Fired once per real HTTP call — lets callers (e.g. the API Explorer) count actual requests made across a pagination loop, without changing this function's return shape. */
  onRequest?: () => void;
}

/**
 * Every endpoint takes its parameters as a JSON body. Petpooja's own curl examples use GET
 * for the Orders API, but their edge started rejecting GET-with-body with a 403 on
 * 2026-10-07; POST carries the identical body and is accepted, so all callers use POST.
 */
export async function petpoojaRequest<T>(opts: PetpoojaRequestOptions): Promise<T> {
  opts.onRequest?.();
  try {
    const res = await axios.request<T>({
      url: opts.url,
      method: opts.method,
      data: opts.body,
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      },
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      logger.error('Petpooja API request failed', {
        url: opts.url,
        status: err.response?.status,
        data: err.response?.data,
      });
      throw new Error(`Petpooja API error (${opts.url}): ${err.response?.status ?? err.message}`);
    }
    throw err;
  }
}
