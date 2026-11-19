// The typed client for the finapp customer surface (ADR-F01, ADR-F03; P18-TSK-003).
// Adapted from finapp-admin-panel/src/platform/api/client.ts (ADR-F08).
//
// openapi-fetch over the types generated from the pinned contract, with middlewares that:
//   - add the session through the configured carrier (ADR-F02) and the CSRF header every request
//     carries (`X-Finapp-Request: 1`, ADR-F02 decision 4);
//   - add a fresh client correlation id per request (finapp echoes it as `X-Client-Correlation-Id`);
//   - bound every request by a timeout;
//   - turn every non-2xx response and every request without a response into a thrown ApiError, so a
//     call either returns its data or throws ApiError - never a half-checked union;
//   - record the server's clock offset from `Date` (server-clock.ts).
//
// Same origin: the base URL is empty and the contract's paths begin with /v1, which the public edge (and
// the Vite dev proxy) route to finapp. No CORS exists or is needed.
import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from '../../generated/finapp-api.ts';
import { sessionCarrier, type SessionCarrier } from '../session/carrier.ts';
import { recordActivity } from '../session/session-store.ts';
import { errorFromFailure, errorFromResponse } from './api-error.ts';
import { observeServerDate } from './server-clock.ts';

export type FinappClient = Client<paths>;

export const CSRF_HEADER = 'X-Finapp-Request';
export const CLIENT_CORRELATION_HEADER = 'X-Correlation-Id';
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ApiClientOptions {
  /** Defaults to '' (same origin). Tests pass an absolute origin. */
  baseUrl?: string;
  /** Defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Per-request timeout; a command that times out has an UNKNOWN outcome (ADR-F05 decision 3). */
  timeoutMs?: number;
  /** Defaults to the configured carrier. */
  carrier?: () => SessionCarrier;
  /** Called after each response finapp accepted the session for (it extends the idle bound). */
  onActivity?: () => void;
  /** Defaults to crypto.randomUUID. */
  correlationId?: () => string;
}

export function createApiClient(options: ApiClientOptions = {}): FinappClient {
  const carrier = options.carrier ?? sessionCarrier;
  const onActivity = options.onActivity ?? (() => recordActivity());
  const correlationId = options.correlationId ?? (() => crypto.randomUUID());
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    fetch: withTimeout(
      options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ),
    headers: { Accept: 'application/json, application/problem+json' },
  });

  const session: Middleware = {
    onRequest({ request }) {
      carrier().decorate(request.headers);
      request.headers.set(CSRF_HEADER, '1');
      request.headers.set(CLIENT_CORRELATION_HEADER, correlationId());
      return request;
    },
  };

  const failures: Middleware = {
    async onResponse({ request, response, schemaPath }) {
      observeServerDate(response.headers.get('Date'));
      if (response.status !== 401) onActivity();
      if (!response.ok) throw await errorFromResponse(response, request.method, schemaPath);
      return undefined;
    },
    onError({ request, error, schemaPath }) {
      return errorFromFailure(error, request.method, schemaPath);
    },
  };

  client.use(session, failures);
  return client;
}

/**
 * Wraps fetch so every request settles within `ms`. The returned promise RACES a timer: it rejects with a
 * `TimeoutError` on time whatever the transport does; the abort handed to fetch is best-effort
 * cancellation only. A caller's own abort rejects at once as an AbortError.
 */
export function withTimeout(base: typeof globalThis.fetch, ms: number): typeof globalThis.fetch {
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const controller = new AbortController();
      const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const onCallerAbort = () => {
        const reason: unknown = caller?.reason ?? new DOMException('The request was cancelled.', 'AbortError');
        controller.abort(reason);
        reject(reason);
      };
      if (caller?.aborted) {
        onCallerAbort();
        return;
      }
      caller?.addEventListener('abort', onCallerAbort, { once: true });
      const timer = setTimeout(() => {
        const reason = new DOMException('The request timed out.', 'TimeoutError');
        controller.abort(reason);
        reject(reason);
      }, ms);
      base(input, { ...init, signal: controller.signal })
        .then(resolve, reject)
        .finally(() => {
          clearTimeout(timer);
          caller?.removeEventListener('abort', onCallerAbort);
        });
    });
}

/** A successful call's data and the correlation reference to show beside its outcome (DOD-CUST). */
export interface ApiSuccess<D> {
  data: D;
  correlationId: string | undefined;
}

/**
 * Unwraps a call made with the client. Because the middleware throws for every failure, the error branch
 * is unreachable; reaching it is a client defect and is thrown loudly.
 */
export async function ok<R extends { response: Response; data?: unknown; error?: unknown }>(
  call: Promise<R>,
): Promise<ApiSuccess<SuccessData<R>>> {
  const result = await call;
  if (result.error !== undefined) {
    throw new Error('Unreachable: a failed call reached ok() without becoming an ApiError.');
  }
  return {
    data: result.data as SuccessData<R>,
    correlationId: result.response.headers.get('X-Correlation-Id') ?? undefined,
  };
}

/** The data type of the success branch of an openapi-fetch result. */
type SuccessData<R> = R extends { data: infer D; error?: never } ? D : never;
