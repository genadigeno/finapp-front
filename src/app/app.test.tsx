// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemProvider } from '../design-system/DesignSystemProvider.tsx';
import { ApiError } from '../platform/api/api-error.ts';
import { ApiProvider } from '../platform/api/api-context.tsx';
import { createApiClient } from '../platform/api/client.ts';
import { AppIntlProvider } from '../platform/i18n/IntlProvider.tsx';
import { memoryCarrier, useCarrierForTests } from '../platform/session/carrier.ts';
import { acceptIssuedSession, endSession } from '../platform/session/session-store.ts';
import { setTelemetryTransport, type TelemetryEvent } from '../platform/telemetry/telemetry.ts';
import { renderWithProviders } from '../testing/render.tsx';
import { createAppQueryClient } from './App.tsx';
import { createAppRouter, RouteError, useReturnTo } from './router.tsx';
import { StepUpProvider } from './StepUpProvider.tsx';

function renderApp(path: string, answer: (url: string) => Response) {
  const api = createApiClient({
    baseUrl: 'https://finapp.test',
    fetch: async (input) => answer(input instanceof Request ? input.url : String(input)),
  });
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) });
  render(
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
  return router;
}

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  endSession('signed-out');
  setTelemetryTransport(undefined);
});

describe('routing (P18-TSK-006; blueprint §17 scenario 1)', () => {
  it('a signed-out visitor to a protected page lands on the start page, with only an allow-listed return path', async () => {
    const router = renderApp('/home', () => json({}));
    expect(await screen.findByRole('heading', { name: 'Welcome to FinApp' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toEqual({ returnTo: '/home' });
  });

  it('a forged returnTo never reaches a page', async () => {
    const seen: Array<string | undefined> = [];
    function Probe() {
      seen.push(useReturnTo());
      return null;
    }
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ['/?returnTo=https%3A%2F%2Fevil.example'] }),
    });
    render(
      <AppIntlProvider locale="en-GB">
        <DesignSystemProvider env="test">
          <QueryClientProvider client={createAppQueryClient()}>
            <ApiProvider client={createApiClient({ baseUrl: 'https://finapp.test', fetch: async () => json({}) })}>
              <RouterProvider
                router={router}
                InnerWrap={({ children }) => (
                  <>
                    {children}
                    <Probe />
                  </>
                )}
              />
            </ApiProvider>
          </QueryClientProvider>
        </DesignSystemProvider>
      </AppIntlProvider>,
    );
    await screen.findByRole('heading', { name: 'Welcome to FinApp' });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((value) => value === undefined)).toBe(true);
    expect(router.state.matches.at(-1)?._strictSearch).toEqual({});
  });

  it('a signed-in customer sees their own profile from GET /v1/me, and nothing about other goals', async () => {
    useCarrierForTests(memoryCarrier());
    acceptIssuedSession({
      sessionToken: 't',
      assurance: 'PASSWORD',
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    });
    renderApp('/home', (url) => (url.endsWith('/v1/me') ? json({ displayName: 'Ada', kind: 'PERSON' }) : json({})));
    expect(await screen.findByRole('heading', { name: 'Hello, Ada' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.textContent).toBe('Home');
  });

  it('an unknown address says so', async () => {
    renderApp('/no-such-page', () => json({}));
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('records the static route id - never the concrete path - as telemetry', async () => {
    const events: TelemetryEvent[] = [];
    setTelemetryTransport((event) => events.push(event));
    renderApp('/', () => json({}));
    await screen.findByRole('heading', { name: 'Welcome to FinApp' });
    expect(events).toContainEqual({ kind: 'route.view', fields: { routeId: '/' } });
  });
});

describe('route error boundary (blueprint §16; scenario 10)', () => {
  it('a module that is unavailable says so - nothing was changed', () => {
    const unavailable = new ApiError({
      kind: 'problem',
      method: 'GET',
      route: '/v1/me/accounts',
      status: 503,
      code: 'api.Overloaded',
    });
    renderWithProviders(<RouteError error={unavailable} reset={() => undefined} />);
    expect(screen.getByText('This part of FinApp is not available right now')).toBeTruthy();
  });

  it('anything else is explained, with a way to try again', () => {
    renderWithProviders(<RouteError error={new Error('chunk failed')} reset={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'This page could not be shown' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
