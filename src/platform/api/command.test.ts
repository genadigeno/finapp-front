import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error.ts';
import type { ApiSuccess } from './client.ts';
import { executeCommand, MAX_RESENDS } from './command.ts';
import { IdempotencyIntent } from './idempotency.ts';

// ADR-F05: one customer intent, at most one effect. Each test records what was SENT and asserts that
// every send carried the same key and the same body.

const problem = (status: number, code: string, retryAfterSeconds?: number) =>
  new ApiError({ kind: 'problem', method: 'POST', route: '/v1/transfers', status, code, retryAfterSeconds });

type Body = { amount: string; currency: string };

function harness(outcomes: Array<ApiError | 'ok'>) {
  const sent: Array<{ key: string; body: Body }> = [];
  const send = vi.fn(async (intent: IdempotencyIntent<Body>): Promise<ApiSuccess<{ id: string }>> => {
    sent.push({ key: intent.key, body: { ...intent.body } });
    const next = outcomes.shift() ?? 'ok';
    if (next === 'ok') return { data: { id: 't-1' }, correlationId: 'c-ok' };
    throw next;
  });
  const intent = IdempotencyIntent.forReview<Body>({ amount: '10.00', currency: 'EUR' }, () => 'key-1');
  const sleep = vi.fn(async () => undefined);
  return { sent, send, intent, sleep };
}

describe('executeCommand (ADR-F05; P18-TSK-003 acceptance 3-4)', () => {
  it('a success is reported with its correlation reference', async () => {
    const { send, intent, sleep } = harness(['ok']);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result).toEqual({ status: 'succeeded', data: { id: 't-1' }, correlationId: 'c-ok' });
  });

  it('replays once after a step-up, with the same key and body', async () => {
    const { sent, send, intent, sleep } = harness([problem(403, 'identity.AssuranceRequired'), 'ok']);
    const requestStepUp = vi.fn(async () => undefined);
    const result = await executeCommand(intent, send, { requestStepUp, sleep });
    expect(result.status).toBe('succeeded');
    expect(requestStepUp).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      { key: 'key-1', body: { amount: '10.00', currency: 'EUR' } },
      { key: 'key-1', body: { amount: '10.00', currency: 'EUR' } },
    ]);
  });

  it('never loops on step-up: a second refusal is final', async () => {
    const { send, intent, sleep } = harness([
      problem(403, 'identity.AssuranceRequired'),
      problem(403, 'identity.AssuranceRequired'),
    ]);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result.status).toBe('refused');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('a cancelled step-up is a refusal and nothing is re-sent', async () => {
    const { send, intent, sleep } = harness([problem(403, 'identity.AssuranceRequired')]);
    const result = await executeCommand(intent, send, {
      requestStepUp: async () => Promise.reject(new Error('cancelled')),
      sleep,
    });
    expect(result.status).toBe('refused');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('re-sends the same request while the key is in progress, then reports the original outcome', async () => {
    const { sent, send, intent, sleep } = harness([problem(409, 'api.IdempotencyInProgress'), 'ok']);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result.status).toBe('succeeded');
    expect(new Set(sent.map((s) => s.key))).toEqual(new Set(['key-1']));
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('re-sends after a not-served 503 with Retry-After, honouring the wait', async () => {
    const { send, intent, sleep } = harness([problem(503, 'api.Overloaded', 2), 'ok']);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result.status).toBe('succeeded');
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('bounds the re-sends, then hands back the outcome', async () => {
    const busy = () => problem(409, 'api.IdempotencyInProgress');
    const { send, intent, sleep } = harness(Array.from({ length: MAX_RESENDS + 1 }, busy));
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result.status).toBe('unknown');
    expect(send).toHaveBeenCalledTimes(MAX_RESENDS + 1);
  });

  it('a timeout is an UNKNOWN outcome and is never re-sent automatically', async () => {
    const timeout = new ApiError({ kind: 'timeout', method: 'POST', route: '/v1/transfers' });
    const { send, intent, sleep } = harness([timeout]);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result).toEqual({ status: 'unknown', error: timeout });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a refusal is final and not re-sent', async () => {
    const { send, intent, sleep } = harness([problem(422, 'lending.InsufficientFunds')]);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result.status).toBe('refused');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a provider 503 on a command is unknown, not refused', async () => {
    const { send, intent, sleep } = harness([problem(503, 'payments.ProviderUnavailable', 1)]);
    const result = await executeCommand(intent, send, { requestStepUp: async () => undefined, sleep });
    expect(result.status).toBe('unknown');
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('IdempotencyIntent (ADR-F05 decision 1)', () => {
  it('freezes the reviewed body - a later edit cannot reach a re-send', () => {
    const body = { amount: '10.00', nested: { note: 'rent' } };
    const intent = IdempotencyIntent.forReview(body, () => 'k');
    body.amount = '99.00';
    expect(intent.body.amount).toBe('10.00');
    expect(Object.isFrozen(intent.body)).toBe(true);
    expect(Object.isFrozen(intent.body.nested)).toBe(true);
    expect(intent.headers()).toEqual({ 'Idempotency-Key': 'k' });
  });

  it('mints a UUID by default and refuses a key finapp would refuse', () => {
    expect(IdempotencyIntent.forReview({}).key).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => IdempotencyIntent.forReview({}, () => 'has space')).toThrow();
    expect(() => IdempotencyIntent.forReview({}, () => 'x'.repeat(201))).toThrow();
  });
});
