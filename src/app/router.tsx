// The application router (TanStack Router, code-based; P18-TSK-006, extended by P18-TSK-010…-016).
//
// - Routes come from the route table: each module declares its pages and their access (src/platform/routing.ts).
//   `signed-in` pages sit under a layout that sends a signed-out visitor to the start page with a validated
//   `returnTo`; `signed-out` pages (sign-in, registration) send a signed-in customer home.
// - Every route has an error boundary: a module that is unavailable (503) shows FeatureUnavailable while the
//   rest of the application works (blueprint §16); anything else is explained, with its reference.
// - Navigation shows only the pages that exist (DOD-CUST: no screen claims a capability whose endpoint is
//   missing), and only to a signed-in customer.
import { Button, Stack, Text, Title } from '@mantine/core';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useMatches,
  useNavigate,
  useRouterState,
  type AnyRoute,
  type RouterHistory,
} from '@tanstack/react-router';
import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CustomerShell, TextButton, type NavItem } from '../design-system/CustomerShell.tsx';
import { ErrorExplained, FeatureUnavailable, LoadingState } from '../design-system/States.tsx';
import { ApiError } from '../platform/api/api-error.ts';
import { useApi } from '../platform/api/api-context.tsx';
import { DEFAULT_SIGNED_IN_PATH, validReturnTo } from '../platform/return-to.ts';
import type { AppRoute } from '../platform/routing.ts';
import { signOut } from '../platform/session/auth-api.ts';
import { useSession } from '../platform/session/standing.ts';
import { track } from '../platform/telemetry/telemetry.ts';
import { OfflineBanner, SessionExpiryWarning } from './Banners.tsx';
import { ROUTES } from './route-table.ts';

const messages = defineMessages({
  signOut: { id: 'shell.signOut', defaultMessage: 'Sign out' },
  notFoundTitle: { id: 'notFound.title', defaultMessage: 'Page not found' },
  notFoundBody: { id: 'notFound.body', defaultMessage: 'There is no page at this address.' },
  notFoundBack: { id: 'notFound.back', defaultMessage: 'Go to the start page' },
  errorTitle: { id: 'routeError.title', defaultMessage: 'This page could not be shown' },
  errorRetry: { id: 'routeError.retry', defaultMessage: 'Try again' },
});

function Layout({ routes }: { routes: readonly AppRoute[] }) {
  const intl = useIntl();
  const api = useApi();
  const session = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const matches = useMatches();
  const routeId = matches.at(-1)?.routeId;

  useEffect(() => {
    // The static route id, never the concrete path (which may carry an identifier) - ADR-F07 decision 5.
    if (routeId !== undefined) track('route.view', { routeId });
  }, [routeId]);

  const navigation: NavItem[] = [];
  if (session.status === 'signed-in') {
    for (const route of [...routes].sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))) {
      if (route.nav === undefined || route.access !== 'signed-in') continue;
      navigation.push({
        label: intl.formatMessage(route.nav.label),
        href: route.path,
        icon: route.nav.icon,
        active: pathname === route.path || pathname.startsWith(`${route.path}/`),
      });
    }
  }

  return (
    <CustomerShell
      navigation={navigation}
      renderLink={(item, children, className) => (
        <Link to={item.href} className={className} aria-current={item.active ? 'page' : undefined}>
          {children}
        </Link>
      )}
      account={
        session.status === 'signed-in' ? (
          <TextButton onClick={() => void signOut(api)}>
            <FormattedMessage {...messages.signOut} />
          </TextButton>
        ) : undefined
      }
      banner={
        <>
          <OfflineBanner />
          <SessionExpiryWarning />
        </>
      }
    >
      <Outlet />
    </CustomerShell>
  );
}

/** Protected pages: a signed-out visitor goes to sign in, remembering only an allow-listed path. */
function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'signed-in') return <>{children}</>;
  return <RedirectOnce to="/sign-in" carryReturnTo />;
}

/** Sign-in and registration: a customer already signed in goes home. */
function RequireNoSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'signed-out') return <>{children}</>;
  return <RedirectOnce to={DEFAULT_SIGNED_IN_PATH} />;
}

/**
 * Redirects once, with the path asked for when the redirect began. (TanStack's <Navigate> navigates again
 * whenever its props change - and while the redirect is pending, the location is already the target, so a
 * second navigation would lose the return path.)
 */
function RedirectOnce({ to, carryReturnTo = false }: { to: string; carryReturnTo?: boolean }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [returnTo] = useState(() => (carryReturnTo ? validReturnTo(pathname) : undefined));
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void navigate({ to, search: returnTo === undefined ? {} : { returnTo }, replace: true });
  }, [navigate, returnTo, to]);
  return null;
}

function NotFound() {
  return (
    <Stack gap="sm">
      <Title order={1}>
        <FormattedMessage {...messages.notFoundTitle} />
      </Title>
      <Text>
        <FormattedMessage {...messages.notFoundBody} />
      </Text>
      <Link to="/">
        <FormattedMessage {...messages.notFoundBack} />
      </Link>
    </Stack>
  );
}

/** A page that failed: a module that is unavailable is said to be; anything else is explained. */
export function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  if (error instanceof ApiError && error.category === 'unavailable') {
    return <FeatureUnavailable correlationId={error.correlationId} />;
  }
  return (
    <Stack gap="md">
      <Title order={1}>
        <FormattedMessage {...messages.errorTitle} />
      </Title>
      <ErrorExplained error={error} />
      <div>
        <Button variant="default" onClick={reset}>
          <FormattedMessage {...messages.errorRetry} />
        </Button>
      </div>
    </Stack>
  );
}

export interface StartSearch {
  returnTo?: string;
}

function page(Component: ComponentType) {
  return function Page() {
    return (
      <Suspense fallback={<LoadingState />}>
        <Component />
      </Suspense>
    );
  };
}

export function createAppRouter(options: { history?: RouterHistory; routes?: readonly AppRoute[] } = {}) {
  const routes = options.routes ?? ROUTES;
  // Search is validated at the ROOT (every route inherits the root's search); pages still read `returnTo`
  // only through useReturnTo, which validates again at the point of use.
  const root = createRootRoute({
    component: () => <Layout routes={routes} />,
    notFoundComponent: NotFound,
    validateSearch: (search: Record<string, unknown>): StartSearch => {
      const returnTo = validReturnTo(search['returnTo']);
      return returnTo === undefined ? {} : { returnTo };
    },
  });

  const signedIn = createRoute({
    getParentRoute: () => root,
    id: 'signed-in',
    component: () => (
      <RequireSession>
        <Outlet />
      </RequireSession>
    ),
  });
  const signedOut = createRoute({
    getParentRoute: () => root,
    id: 'signed-out',
    component: () => (
      <RequireNoSession>
        <Outlet />
      </RequireNoSession>
    ),
  });

  const byAccess: Record<AppRoute['access'], AnyRoute[]> = { public: [], 'signed-in': [], 'signed-out': [] };
  for (const route of routes) {
    const parent = route.access === 'public' ? root : route.access === 'signed-in' ? signedIn : signedOut;
    byAccess[route.access].push(
      createRoute({ getParentRoute: () => parent, path: route.path, component: page(route.component) }),
    );
  }

  return createRouter({
    routeTree: root.addChildren([
      ...byAccess.public,
      signedIn.addChildren(byAccess['signed-in']),
      signedOut.addChildren(byAccess['signed-out']),
    ]),
    defaultErrorComponent: RouteError,
    ...(options.history === undefined ? {} : { history: options.history }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
