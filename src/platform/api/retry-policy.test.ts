// The read retry policy (blueprint §11.1; docs/RUNBOOK.md §5): transient read failures are retried a bounded number of
// times with jittered, capped backoff; answers (4xx) and commands never are.
import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error.ts';
import { MAX_READ_ATTEMPTS, retryDelayMs, shouldRetry } from './retry-policy.ts';

const error = (method: string, init: { kind?: 'problem' | 'network' | 'timeout' | 'aborted'; status?: number }) =>
  new ApiError({ kind: init.kind ?? 'problem', method, route: '/v1/x', status: init.status });

describe('the read retry policy', () => {
  it('retries a read that got no answer or a 5xx, up to the bound', () => {
    expect(shouldRetry(1, error('GET', { kind: 'network' }))).toBe(true);
    expect(shouldRetry(1, error('GET', { kind: 'timeout' }))).toBe(true);
    expect(shouldRetry(1, error('GET', { status: 503 }))).toBe(true);
    expect(shouldRetry(MAX_READ_ATTEMPTS, error('GET', { status: 503 }))).toBe(false);
  });

  it('never retries an answer, an abort, a command, or something that is not an API error', () => {
    expect(shouldRetry(1, error('GET', { status: 404 }))).toBe(false);
    expect(shouldRetry(1, error('GET', { status: 401 }))).toBe(false);
    expect(shouldRetry(1, error('GET', { kind: 'aborted' }))).toBe(false);
    expect(shouldRetry(1, error('POST', { kind: 'network' }))).toBe(false);
    expect(shouldRetry(1, error('POST', { status: 503 }))).toBe(false);
    expect(shouldRetry(1, new Error('boom'))).toBe(false);
  });

  it('waits a jittered, growing, capped delay', () => {
    expect(retryDelayMs(1, () => 0.999)).toBe(499);
    expect(retryDelayMs(2, () => 0.999)).toBe(999);
    expect(retryDelayMs(10, () => 0.999)).toBe(7_992);
    expect(retryDelayMs(3, () => 0)).toBe(0);
  });
});
