import { describe, expect, it } from 'vitest';
import { ApiError, errorFromFailure, errorFromResponse, parseRetryAfter, type ErrorCategory } from './api-error.ts';

const problem = (method: string, status: number, code: string) =>
  new ApiError({ kind: 'problem', method, route: '/v1/x', status, code });

describe('every failure has one handling class (blueprint §11.1; P18-TSK-003)', () => {
  it.each<[string, ApiError, ErrorCategory]>([
    ['422 validation', problem('POST', 422, 'api.ValidationFailed'), 'validation'],
    ['401', problem('GET', 401, 'api.Unauthenticated'), 'unauthenticated'],
    ['step-up', problem('POST', 403, 'identity.AssuranceRequired'), 'assurance'],
    ['403', problem('POST', 403, 'api.Forbidden'), 'forbidden'],
    ['404 (also "not yours")', problem('GET', 404, 'api.NotFound'), 'not-found'],
    ['a business refusal', problem('POST', 422, 'lending.InsufficientFunds'), 'refused'],
    ['a 409 refusal', problem('POST', 409, 'lending.LoanClosed'), 'refused'],
    ['in progress', problem('POST', 409, 'api.IdempotencyInProgress'), 'in-progress'],
    ['an expired quote', problem('POST', 409, 'fx.QuoteExpired'), 'stale'],
    ['a stale payoff quote', problem('POST', 409, 'lending.PayoffQuoteStale'), 'stale'],
    ['changed terms', problem('POST', 409, 'lending.TermsChanged'), 'stale'],
    ['429', problem('POST', 429, 'api.TooManyRequests'), 'rate-limited'],
    ['overloaded', problem('POST', 503, 'api.Overloaded'), 'unavailable'],
    ['a provider outage on a command', problem('POST', 503, 'payments.ProviderUnavailable'), 'unknown-outcome'],
    ['a provider outage on a read', problem('GET', 503, 'payments.ProviderUnavailable'), 'unavailable'],
    ['the same key with another body', problem('POST', 409, 'api.Conflict'), 'defect'],
    ['a missing key', problem('POST', 422, 'api.IdempotencyKeyRequired'), 'defect'],
    ['a CSRF refusal', problem('POST', 403, 'identity.CsrfRejected'), 'defect'],
    ['malformed', problem('POST', 400, 'api.MalformedRequest'), 'defect'],
  ])('%s', (_label, error, category) => {
    expect(error.category).toBe(category);
  });

  it('a command with no response has an unknown outcome; a read with none is unavailable', () => {
    expect(new ApiError({ kind: 'timeout', method: 'POST', route: '/v1/transfers' }).category).toBe('unknown-outcome');
    expect(new ApiError({ kind: 'network', method: 'GET', route: '/v1/me' }).category).toBe('unavailable');
  });
});

describe('a command applied or not (ADR-F05 decision 3)', () => {
  it('a refusal was not applied', () => {
    expect(problem('POST', 422, 'lending.InsufficientFunds').commandOutcome).toBe('not-applied');
  });

  it('no response, an in-flight key and an unexplained 5xx are unknown', () => {
    expect(new ApiError({ kind: 'timeout', method: 'POST', route: '/v1/x' }).commandOutcome).toBe('unknown');
    expect(problem('POST', 409, 'api.IdempotencyInProgress').commandOutcome).toBe('unknown');
    expect(problem('POST', 500, 'api.InternalError').commandOutcome).toBe('unknown');
    expect(new ApiError({ kind: 'edge', method: 'POST', route: '/v1/x', status: 502 }).commandOutcome).toBe('unknown');
  });

  it('only the 503s finapp declares not served are "not applied"', () => {
    expect(problem('POST', 503, 'api.Overloaded').commandOutcome).toBe('not-applied');
    expect(problem('POST', 503, 'api.TemporarilyUnavailable').commandOutcome).toBe('not-applied');
    expect(problem('POST', 503, 'crossborder.ProviderUnavailable').commandOutcome).toBe('unknown');
  });
});

describe('reading a failure', () => {
  it('keeps only the problem document members and the correlation id', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'No',
        status: 409,
        code: 'fx.QuoteExpired',
        correlationId: 'c-1',
        extra: 'secret',
      }),
      { status: 409, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '3' } },
    );
    const error = await errorFromResponse(response, 'post', '/v1/me/fx/conversions');
    expect(error.toJSON()).toEqual({
      kind: 'problem',
      method: 'POST',
      route: '/v1/me/fx/conversions',
      status: 409,
      code: 'fx.QuoteExpired',
      correlationId: 'c-1',
    });
    expect(error.retryAfterSeconds).toBe(3);
    expect(JSON.stringify(error)).not.toContain('secret');
  });

  it('an edge answer without a problem document is kind "edge"', async () => {
    const error = await errorFromResponse(new Response('<html>', { status: 404 }), 'GET', '/v1/x');
    expect(error.kind).toBe('edge');
  });

  it('classifies timeouts and aborts', () => {
    expect(errorFromFailure(new DOMException('t', 'TimeoutError'), 'GET', '/v1/x').kind).toBe('timeout');
    expect(errorFromFailure(new DOMException('a', 'AbortError'), 'GET', '/v1/x').kind).toBe('aborted');
    expect(errorFromFailure(new TypeError('fetch failed'), 'GET', '/v1/x').kind).toBe('network');
  });

  it('parses Retry-After as seconds or a date', () => {
    expect(parseRetryAfter('5')).toBe(5);
    expect(parseRetryAfter('Thu, 19 Nov 2026 12:00:10 GMT', Date.parse('2026-11-19T12:00:00Z'))).toBe(10);
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});
