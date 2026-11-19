// The application's providers and session wiring (P18-TSK-004, -006).
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DesignSystemProvider } from '../design-system/DesignSystemProvider.tsx';
import { ApiError } from '../platform/api/api-error.ts';
import { ApiProvider } from '../platform/api/api-context.tsx';
import { createApiClient } from '../platform/api/client.ts';
import { AppIntlProvider } from '../platform/i18n/IntlProvider.tsx';
import { createQueryClient } from '../platform/query/query-client.ts';
import { openCrossTab, setCrossTabPoster } from '../platform/session/cross-tab.ts';
import { endSession, sessionState, subscribeSession } from '../platform/session/session-store.ts';
import { track } from '../platform/telemetry/telemetry.ts';
import { createAppRouter } from './router.tsx';
import { StepUpProvider } from './StepUpProvider.tsx';

/** A 401 anywhere ends the session here; failures are reported by category and code only (ADR-F07). */
export function createAppQueryClient(): QueryClient {
  return createQueryClient({
    onUnauthenticated: () => endSession('expired'),
    onFailure: (error) => {
      if (error instanceof ApiError) {
        track('api.failure', {
          routeId: error.route,
          category: error.category,
          code: error.code,
          status: error.status === undefined ? undefined : String(error.status),
          correlationId: error.correlationId,
        });
      } else {
        track('app.defect', {});
      }
    },
  });
}

export function App() {
  const [api] = useState(() => createApiClient());
  const [queryClient] = useState(createAppQueryClient);
  const [router] = useState(() => createAppRouter());

  useEffect(() => {
    // Other tabs: a sign-out there signs out here; a command there re-reads the named roots here.
    const crossTab = openCrossTab((message) => {
      if (message.type === 'signed-out') endSession('elsewhere');
      else for (const root of message.roots) void queryClient.invalidateQueries({ queryKey: [root] });
    });
    setCrossTabPoster(crossTab.post);
    // Leaving the session (any reason) drops every cached read: nothing of one session survives into the next.
    let wasSignedIn = sessionState().status === 'signed-in';
    const unsubscribe = subscribeSession(() => {
      const state = sessionState();
      if (wasSignedIn && state.status === 'signed-out') {
        queryClient.clear();
        if (state.reason !== 'elsewhere') crossTab.post({ type: 'signed-out' });
      }
      wasSignedIn = state.status === 'signed-in';
    });
    return () => {
      unsubscribe();
      setCrossTabPoster(undefined);
      crossTab.close();
    };
  }, [queryClient]);

  return (
    <AppIntlProvider>
      <DesignSystemProvider>
        <QueryClientProvider client={queryClient}>
          <ApiProvider client={api}>
            <StepUpProvider>
              <RouterProvider router={router} />
            </StepUpProvider>
          </ApiProvider>
        </QueryClientProvider>
      </DesignSystemProvider>
    </AppIntlProvider>
  );
}
