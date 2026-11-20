import { afterEach, describe, expect, it } from 'vitest';
import { createApiClient } from '../src/platform/api/client.ts';
import { restoreSession } from '../src/platform/session/auth-api.ts';
import { cookieCarrier, memoryCarrier, setCarrierForTests } from '../src/platform/session/carrier.ts';
import { endSession, sessionState } from '../src/platform/session/session-store.ts';

// After a reload with the cookie carrier, only finapp can say whether the HttpOnly cookie still names a live
// session (ADR-F02; finapp ADR-0156): restoreSession asks once, at start-up.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

function client(answer: () => Response) {
  const asked: string[] = [];
  const api = createApiClient({
    baseUrl: 'https://finapp.test',
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      asked.push(`${request.method} ${new URL(request.url).pathname}`);
      return answer();
    },
    onActivity: () => undefined,
    correlationId: () => '00000000-0000-4000-8000-000000000001',
  });
  return { api, asked };
}

afterEach(() => {
  endSession('signed-out');
  setCarrierForTests(memoryCarrier());
});

describe('restoring a cookie-carried session after a reload (ADR-0156)', () => {
  it('takes up the live current session finapp reports, with its assurance and idle bound', async () => {
    setCarrierForTests(cookieCarrier());
    const { api, asked } = client(() =>
      json([
        { id: 'other', current: false, assurance: 'PASSWORD', idleExpiresAt: '2026-11-21T09:00:00Z' },
        { id: 'this', current: true, assurance: 'MULTI_FACTOR', idleExpiresAt: '2026-11-21T10:30:00Z' },
      ]),
    );
    await expect(restoreSession(api)).resolves.toBe(true);
    expect(asked).toEqual(['GET /v1/sessions']);
    const state = sessionState();
    expect(state.status).toBe('signed-in');
    if (state.status === 'signed-in') {
      expect(state.assurance).toBe('MULTI_FACTOR');
      expect(state.idleExpiresAt).toBe(Date.parse('2026-11-21T10:30:00Z'));
    }
  });

  it('stays signed out when the cookie names no live session (401)', async () => {
    setCarrierForTests(cookieCarrier());
    const { api } = client(() =>
      json(
        { type: 'about:blank', title: 'Authentication is required.', status: 401, code: 'api.Unauthenticated' },
        401,
      ),
    );
    await expect(restoreSession(api)).resolves.toBe(false);
    expect(sessionState().status).toBe('signed-out');
  });

  it('stays signed out when no session in the list is the current one', async () => {
    setCarrierForTests(cookieCarrier());
    const { api } = client(() => json([{ id: 'other', current: false, idleExpiresAt: '2026-11-21T09:00:00Z' }]));
    await expect(restoreSession(api)).resolves.toBe(false);
    expect(sessionState().status).toBe('signed-out');
  });

  it('asks nothing with the memory carrier: a reload there has no session to find', async () => {
    setCarrierForTests(memoryCarrier());
    const { api, asked } = client(() => json([]));
    await expect(restoreSession(api)).resolves.toBe(false);
    expect(asked).toEqual([]);
  });
});
