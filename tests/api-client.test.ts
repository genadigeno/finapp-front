import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/platform/api/api-error.ts';
import { createApiClient, ok, withTimeout } from '../src/platform/api/client.ts';
import { resetServerClock, serverOffsetMs } from '../src/platform/api/server-clock.ts';
import { cookieCarrier, memoryCarrier, type SessionCarrier } from '../src/platform/session/carrier.ts';

// The client against a scripted transport: what it SENDS (headers, carrier) and how it reads answers.

interface Seen {
  headers: Headers;
  url: string;
  method: string;
}

function transport(answer: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const record = { headers: request.headers, url: request.url, method: request.method };
    seen.push(record);
    return answer(record);
  };
  return { seen, fetch };
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

function client(carrier: SessionCarrier, fetch: typeof globalThis.fetch, timeoutMs = 1_000) {
  return createApiClient({
    baseUrl: 'https://finapp.test',
    fetch,
    carrier: () => carrier,
    onActivity: () => undefined,
    correlationId: () => '00000000-0000-4000-8000-000000000001',
    timeoutMs,
  });
}

afterEach(() => resetServerClock());

describe('every request carries the CSRF header and a client correlation id (ADR-F02 decision 4)', () => {
  it('sets X-Finapp-Request and X-Correlation-Id', async () => {
    const { seen, fetch } = transport(() => json({ kind: 'PERSON' }));
    await ok(client(memoryCarrier(), fetch).GET('/v1/me'));
    expect(seen[0]?.headers.get('X-Finapp-Request')).toBe('1');
    expect(seen[0]?.headers.get('X-Correlation-Id')).toBe('00000000-0000-4000-8000-000000000001');
  });
});

describe('the session carrier (ADR-F02; P18-TSK-004)', () => {
  it('memory: sends the bearer only once a session is accepted, and rotates it atomically', async () => {
    const carrier = memoryCarrier();
    const { seen, fetch } = transport(() => json({}));
    const api = client(carrier, fetch);
    await ok(api.GET('/v1/me'));
    expect(seen[0]?.headers.has('Authorization')).toBe(false);
    carrier.accept({ sessionToken: 'tok-1', assurance: 'PASSWORD', expiresAt: '2026-11-19T12:30:00Z' });
    await ok(api.GET('/v1/me'));
    expect(seen[1]?.headers.get('Authorization')).toBe('Bearer tok-1');
    carrier.accept({ sessionToken: 'tok-2', assurance: 'MULTI_FACTOR', expiresAt: '2026-11-19T12:30:00Z' });
    await ok(api.GET('/v1/me'));
    expect(seen[2]?.headers.get('Authorization')).toBe('Bearer tok-2');
    carrier.clear();
    await ok(api.GET('/v1/me'));
    expect(seen[3]?.headers.has('Authorization')).toBe(false);
  });

  it('memory: refuses an issue without a token', () => {
    expect(() => memoryCarrier().accept({ expiresAt: '2026-11-19T12:30:00Z' })).toThrow();
  });

  it('cookie: never sends a bearer, always opts in, and never keeps a token it is handed', async () => {
    const carrier = cookieCarrier();
    carrier.accept({ sessionToken: 'should-not-be-kept', expiresAt: '2026-11-19T12:30:00Z' });
    const { seen, fetch } = transport(() => json({}));
    await ok(client(carrier, fetch).GET('/v1/me'));
    expect(seen[0]?.headers.has('Authorization')).toBe(false);
    expect(seen[0]?.headers.get('X-Finapp-Session-Carrier')).toBe('cookie');
    expect(JSON.stringify(carrier)).not.toContain('should-not-be-kept');
  });
});

describe('answers', () => {
  it('returns data and the correlation reference', async () => {
    const { fetch } = transport(() =>
      json({ kind: 'PERSON' }, { headers: { 'X-Correlation-Id': 'corr-1', 'Content-Type': 'application/json' } }),
    );
    const result = await ok(client(memoryCarrier(), fetch).GET('/v1/me'));
    expect(result).toEqual({ data: { kind: 'PERSON' }, correlationId: 'corr-1' });
  });

  it('throws an ApiError with the route template, never the concrete path', async () => {
    const { fetch } = transport(
      () =>
        new Response(JSON.stringify({ type: 'about:blank', title: 'Not found', status: 404, code: 'api.NotFound' }), {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    );
    const failure = await ok(
      client(memoryCarrier(), fetch).GET('/v1/transfers/{id}', { params: { path: { id: 'acc-secret-id' } } }),
    ).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).route).toBe('/v1/transfers/{id}');
    expect(JSON.stringify(failure)).not.toContain('acc-secret-id');
  });

  it('a request that outlives the timeout is a timeout - for a command, an unknown outcome', async () => {
    const { fetch } = transport(() => new Promise<Response>(() => undefined));
    const failure = await ok(
      client(memoryCarrier(), fetch, 20).POST('/v1/authentications', {
        body: { loginIdentifier: 'abc', password: 'x' },
      }),
    ).catch((e: unknown) => e);
    expect((failure as ApiError).kind).toBe('timeout');
    expect((failure as ApiError).category).toBe('unknown-outcome');
  });

  it('records the server clock offset from Date', async () => {
    const serverDate = new Date(Date.now() + 120_000).toUTCString();
    const { fetch } = transport(() => json({}, { headers: { Date: serverDate, 'Content-Type': 'application/json' } }));
    await ok(client(memoryCarrier(), fetch).GET('/v1/me'));
    expect(Math.abs(serverOffsetMs() - 120_000)).toBeLessThan(2_000);
  });
});

describe('withTimeout', () => {
  it('a caller abort rejects at once as an AbortError', async () => {
    const controller = new AbortController();
    const pending = withTimeout(() => new Promise<Response>(() => undefined), 10_000)('https://x.test', {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
