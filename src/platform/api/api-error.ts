// Every failure of a call to the finapp API, in one typed shape (P18-TSK-003; blueprint §11.1).
// Adapted from finapp-admin-panel/src/platform/api/api-error.ts (ADR-F08).
//
// finapp answers failures as RFC 9457 problem details with a stable `code` (finapp
// docs/architecture/ERROR_CONTRACT.md); clients switch on `code`, never on `title` or `status`. The
// public edge answers some requests itself with PLAIN responses (404 for a route not on the allow-list,
// 413, 429, 5xx) - those are `kind: 'edge'`.
//
// An ApiError never carries a response body beyond the problem document's own members, never the
// request body, and never a session token: a customer may quote it to support.

export type ApiErrorKind =
  /** The application answered with a problem document. */
  | 'problem'
  /** Something in front of the application (the public edge) answered without one. */
  | 'edge'
  /** The request never produced a response: the network failed or the connection dropped. */
  | 'network'
  /** No response within the client's timeout. The backend may still have acted. */
  | 'timeout'
  /** The caller cancelled the request. The backend may still have acted. */
  | 'aborted';

/** For a command (an unsafe method): did it certainly not take effect, or is its outcome unknown? */
export type CommandOutcome = 'not-applied' | 'unknown';

/**
 * The classes of blueprint §11.1, each with one handling rule. Screens and the command runner switch on
 * this, never on a raw status.
 */
export type ErrorCategory =
  /** 422 `api.ValidationFailed` or a module's field refusal: say what to change. */
  | 'validation'
  /** 401: the session is gone - sign in again with a validated return route. */
  | 'unauthenticated'
  /** 403 `identity.AssuranceRequired`: step up, then replay once with the same key. */
  | 'assurance'
  /** 403 otherwise: explain, never retry. */
  | 'forbidden'
  /** 404: generic "not found" - also how finapp answers "not yours". */
  | 'not-found'
  /** A business refusal (409/422 with a module code): explain with its next step. */
  | 'refused'
  /** The same key is still being processed: wait and send the same request again. */
  | 'in-progress'
  /** The record moved since it was read (quote expired, terms changed, payoff stale): re-read and re-review. */
  | 'stale'
  /** 429: honour Retry-After. */
  | 'rate-limited'
  /** 503 that finapp declares not served: nothing was done; the same key is safe after Retry-After. */
  | 'unavailable'
  /** No definite answer: the command may have been applied. */
  | 'unknown-outcome'
  /** A client defect: malformed request, `api.Conflict` on a reused key, a missing key, a CSRF refusal. */
  | 'defect';

/** The 5xx codes finapp declares were NOT served (ERROR_CONTRACT.md §platform), so the act did not apply. */
const NOT_SERVED_5XX: ReadonlySet<string> = new Set(['api.TemporarilyUnavailable', 'api.Overloaded']);

/** Codes that mean the client sent something it should never have sent. */
const DEFECT_CODES: ReadonlySet<string> = new Set([
  'api.MalformedRequest',
  'api.MethodNotAllowed',
  'api.NotAcceptable',
  'api.UnsupportedMediaType',
  'api.PayloadTooLarge',
  'api.IdempotencyKeyRequired',
  // The same idempotency key with a different body (ADR-F05 decision 4): never resolved automatically.
  'api.Conflict',
  // The cookie carrier's CSRF refusal (ADR-F02 decision 4), once finapp implements it.
  'identity.CsrfRejected',
]);

/** Stale-read codes beyond the `…Stale` suffix (ADR-F05 decision 7). */
const STALE_CODES: ReadonlySet<string> = new Set([
  'fx.QuoteExpired',
  'checkout.SessionExpired',
  'lending.TermsChanged',
  'bnpl.TermsChanged',
]);

export interface ApiErrorInit {
  kind: ApiErrorKind;
  method: string;
  /** The route template (`/v1/me/accounts/{id}`), never the concrete path. */
  route: string;
  status?: number | undefined;
  code?: string | undefined;
  title?: string | undefined;
  detail?: string | undefined;
  correlationId?: string | undefined;
  retryAfterSeconds?: number | undefined;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly method: string;
  readonly route: string;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly title: string | undefined;
  readonly detail: string | undefined;
  readonly correlationId: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(init: ApiErrorInit) {
    super(summary(init));
    this.name = 'ApiError';
    this.kind = init.kind;
    this.method = init.method.toUpperCase();
    this.route = init.route;
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.correlationId = init.correlationId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }

  get isSafeMethod(): boolean {
    return SAFE_METHODS.has(this.method);
  }

  get isUnauthenticated(): boolean {
    return this.status === 401 || this.code === 'api.Unauthenticated';
  }

  get isAssuranceRequired(): boolean {
    return this.code === 'identity.AssuranceRequired';
  }

  get isIdempotencyInProgress(): boolean {
    return this.code === 'api.IdempotencyInProgress';
  }

  /** finapp declared it did not serve the request: nothing was done (ERROR_CONTRACT.md). */
  get isNotServed(): boolean {
    return this.code !== undefined && NOT_SERVED_5XX.has(this.code);
  }

  /**
   * For a command, whether the platform certainly did NOT apply it, or whether it may have.
   *
   * - No response (network, timeout, aborted): unknown - the request may have committed.
   * - A 4xx: not applied (finapp refuses before the effect), except `api.IdempotencyInProgress`: the
   *   first attempt is still running.
   * - A 5xx: unknown, except the codes finapp declares were not served. An edge 5xx can mean the
   *   application answered and the edge failed to relay it.
   */
  get commandOutcome(): CommandOutcome {
    if (this.kind === 'network' || this.kind === 'timeout' || this.kind === 'aborted') return 'unknown';
    if (this.isIdempotencyInProgress) return 'unknown';
    if (this.status !== undefined && this.status >= 500) return this.isNotServed ? 'not-applied' : 'unknown';
    return 'not-applied';
  }

  /** The handling class of blueprint §11.1. */
  get category(): ErrorCategory {
    if (this.kind === 'network' || this.kind === 'timeout' || this.kind === 'aborted') {
      return this.isSafeMethod ? 'unavailable' : 'unknown-outcome';
    }
    if (this.isUnauthenticated) return 'unauthenticated';
    if (this.isAssuranceRequired) return 'assurance';
    if (this.isIdempotencyInProgress) return 'in-progress';
    const code = this.code;
    if (code !== undefined) {
      if (DEFECT_CODES.has(code)) return 'defect';
      if (STALE_CODES.has(code) || code.endsWith('Stale')) return 'stale';
      if (code === 'api.ValidationFailed') return 'validation';
    }
    const status = this.status ?? 0;
    if (status === 429) return 'rate-limited';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not-found';
    if (status >= 500) {
      if (this.isSafeMethod || this.isNotServed) return 'unavailable';
      return 'unknown-outcome';
    }
    if (status === 400) return 'defect';
    if (status === 409 || status === 422) return 'refused';
    return 'defect';
  }

  /** What may be logged or reported: no body, no token, no concrete identifiers. */
  toJSON(): Record<string, unknown> {
    return {
      kind: this.kind,
      method: this.method,
      route: this.route,
      status: this.status,
      code: this.code,
      correlationId: this.correlationId,
    };
  }
}

function summary(init: ApiErrorInit): string {
  const where = `${init.method.toUpperCase()} ${init.route}`;
  switch (init.kind) {
    case 'problem':
      return `${where} failed: ${init.code ?? 'unknown code'} (${init.status ?? '?'})`;
    case 'edge':
      return `${where} was answered by the edge with ${init.status ?? '?'}`;
    case 'network':
      return `${where} got no response (network)`;
    case 'timeout':
      return `${where} got no response in time`;
    case 'aborted':
      return `${where} was cancelled`;
  }
}

interface ProblemDocument {
  status: number;
  code: string;
  title?: string;
  detail?: string;
  correlationId?: string;
}

function isProblemDocument(value: unknown): value is ProblemDocument {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['code'] === 'string' && typeof v['status'] === 'number';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** `Retry-After` in seconds; an HTTP date is converted relative to `now`. */
export function parseRetryAfter(header: string | null, now: number = Date.now()): number | undefined {
  if (header === null || header.trim() === '') return undefined;
  if (/^\d+$/.test(header.trim())) return Number.parseInt(header.trim(), 10);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}

/**
 * Classifies a non-2xx response. Reads the body only when it is declared a problem document, and keeps
 * only that document's members; any other body is discarded unread.
 */
export async function errorFromResponse(response: Response, method: string, route: string): Promise<ApiError> {
  const correlationId = response.headers.get('X-Correlation-Id') ?? undefined;
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.toLowerCase().includes('application/problem+json')) {
    let parsed: unknown;
    try {
      parsed = await response.clone().json();
    } catch {
      parsed = undefined;
    }
    if (isProblemDocument(parsed)) {
      return new ApiError({
        kind: 'problem',
        method,
        route,
        status: response.status,
        code: parsed.code,
        title: optionalString(parsed.title),
        detail: optionalString(parsed.detail),
        correlationId: optionalString(parsed.correlationId) ?? correlationId,
        retryAfterSeconds,
      });
    }
  }
  return new ApiError({ kind: 'edge', method, route, status: response.status, correlationId, retryAfterSeconds });
}

/** Classifies a request that produced no response at all. */
export function errorFromFailure(failure: unknown, method: string, route: string): ApiError {
  const name = failure instanceof Error || failure instanceof DOMException ? failure.name : undefined;
  const kind: ApiErrorKind = name === 'TimeoutError' ? 'timeout' : name === 'AbortError' ? 'aborted' : 'network';
  return new ApiError({ kind, method, route });
}
