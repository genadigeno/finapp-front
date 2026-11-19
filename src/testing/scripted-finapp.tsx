// Test-only: the application over a SCRIPTED finapp - each test states the answers finapp gives (taken from
// its contract and ERROR_CONTRACT.md) and asserts on what the application sent. Never imported by the app.
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { createAppQueryClient } from '../app/App.tsx';
import { createAppRouter } from '../app/router.tsx';
import { StepUpProvider } from '../app/StepUpProvider.tsx';
import { DesignSystemProvider } from '../design-system/DesignSystemProvider.tsx';
import { ApiProvider } from '../platform/api/api-context.tsx';
import { createApiClient } from '../platform/api/client.ts';
import { AppIntlProvider } from '../platform/i18n/IntlProvider.tsx';
import { memoryCarrier, setCarrierForTests } from '../platform/session/carrier.ts';
import { acceptIssuedSession } from '../platform/session/session-store.ts';

export interface Sent {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

type Answer = Response | ((sent: Sent) => Response | Promise<Response>);

/** `METHOD /path` → an answer, or a queue of answers consumed in order (the last one repeats). */
export type Script = Record<string, Answer | Answer[]>;

// Each helper returns a FACTORY: every request gets its own Response. A Response shared between requests (or
// between tests) is cloned from a body that a cancelled request may already have torn down.
export const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': '0190a3c1-1111-7222-8333-444455556666' },
    });

export const empty =
  (status = 204) =>
  () =>
    new Response(null, { status });

export const problem =
  (status: number, code: string, extra: Record<string, unknown> = {}) =>
  () =>
    new Response(JSON.stringify({ type: 'about:blank', title: code, status, code, ...extra }), {
      status,
      headers: {
        'Content-Type': 'application/problem+json',
        'X-Correlation-Id': '0190a3c1-2222-7222-8333-444455556666',
      },
    });

export function scriptedFetch(script: Script) {
  const sent: Sent[] = [];
  const queues = new Map<string, Answer[]>(
    Object.entries(script).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text();
    const record: Sent = {
      method: request.method,
      path: url.pathname,
      headers: request.headers,
      body: text === '' ? undefined : (JSON.parse(text) as unknown),
    };
    sent.push(record);
    const queue = queues.get(`${request.method} ${url.pathname}`);
    if (queue === undefined || queue.length === 0) {
      return problem(404, 'api.NotFound')();
    }
    const answer = queue.length > 1 ? queue.shift() : queue[0];
    if (answer === undefined) return problem(404, 'api.NotFound')();
    return typeof answer === 'function' ? answer(record) : answer.clone();
  };
  return { sent, fetch };
}

export const ISSUED = (assurance = 'PASSWORD', token = 'tok-test') => ({
  sessionToken: token,
  assurance,
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
});

export function signInForTest(): void {
  setCarrierForTests(memoryCarrier());
  acceptIssuedSession(ISSUED());
}

export function renderAppAt(path: string, script: Script) {
  const { sent, fetch } = scriptedFetch(script);
  const api = createApiClient({ baseUrl: 'https://finapp.test', fetch });
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) });
  const view = render(
    <AppIntlProvider locale="en-GB">
      <DesignSystemProvider env="test">
        <QueryClientProvider client={createAppQueryClient()}>
          <ApiProvider client={api}>
            <StepUpProvider>
              <RouterProvider router={router} />
            </StepUpProvider>
          </ApiProvider>
        </QueryClientProvider>
      </DesignSystemProvider>
    </AppIntlProvider>,
  );
  return { sent, router, view };
}
