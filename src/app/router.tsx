// The application router (TanStack Router, code-based; P18-TSK-006).
//
// - Public routes render for anyone; protected routes sit under a layout that requires a session and
//   sends a signed-out visitor to the start page with a validated `returnTo` (ADR-F07 decision 7).
// - Every route has an error boundary: a module that is unavailable (503) shows FeatureUnavailable while
//   the rest of the application works (blueprint §16); anything else is explained, with its reference.
// - Navigation shows only the pages that exist: a goal appears in the shell when its stage ships it
//   (DOD-CUST: no screen claims a capability whose endpoint is missing).
import { Button, Stack, Text, Title } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useMatches,
  useNavigate,
  useRouterState,
  type RouterHistory,
} from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CustomerShell, TextButton, type NavItem } from '../design-system/CustomerShell.tsx';
import { ErrorExplained, FeatureUnavailable } from '../design-system/States.tsx';
import { ApiError } from '../platform/api/api-error.ts';
import { useApi } from '../platform/api/api-context.tsx';
import { signOut } from '../platform/session/auth-api.ts';
import { useSession } from '../platform/session/standing.ts';
import { track } from '../platform/telemetry/telemetry.ts';
import { OfflineBanner, SessionExpiryWarning } from './Banners.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { WelcomePage } from './pages/WelcomePage.tsx';
import { validReturnTo } from './return-to.ts';

const messages = defineMessages({
  home: { id: 'nav.home', defaultMessage: 'Home' },
  signOut: { id: 'shell.signOut', defaultMessage: 'Sign out' },
  notFoundTitle: { id: 'notFound.title', defaultMessage: 'Page not found' },
  notFoundBody: { id: 'notFound.body', defaultMessage: 'There is no page at this address.' },
  notFoundBack: { id: 'notFound.back', defaultMessage: 'Go to the start page' },
  errorTitle: { id: 'routeError.title', defaultMessage: 'This page could not be shown' },
  errorRetry: { id: 'routeError.retry', defaultMessage: 'Try again' },
});

function Layout() {
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

  const navigation: NavItem[] =
    session.status === 'signed-in'
      ? [{ label: intl.formatMessage(messages.home), href: '/home', icon: IconHome, active: pathname === '/home' }]
      : [];

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

/** Protected pages: a signed-out visitor goes to the start page, remembering only an allow-listed path. */
function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'signed-in') return <>{children}</>;
  return <RedirectToStart />;
}

/**
 * Redirects once, with the path asked for when the redirect began. (TanStack's <Navigate> navigates again
 * whenever its props change - and while the redirect is pending, the location is already the start page,
 * so a second navigation would lose the return path.)
 */
function RedirectToStart() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [returnTo] = useState(() => validReturnTo(pathname));
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void navigate({ to: '/', search: returnTo === undefined ? {} : { returnTo }, replace: true });
  }, [navigate, returnTo]);
  return null;
}

/**
 * The validated return path for the sign-in page (Stage 2). TanStack merges every route's search with the
 * raw query string, so a page must never read `returnTo` from the search directly: it reads it here, where
 * it is validated again at the point of use (ADR-F07 decision 7).
 */
export function useReturnTo(): string | undefined {
  const raw = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)['returnTo'] });
  return validReturnTo(raw);
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

export function createAppRouter(options: { history?: RouterHistory } = {}) {
  // Search is validated at the ROOT: every route inherits the root's search, so a key validated only on a
  // child would still reach it raw through the parent. Anything but an allow-listed returnTo is dropped here,
  // before any page sees it.
  const root = createRootRoute({
    component: Layout,
    notFoundComponent: NotFound,
    validateSearch: (search: Record<string, unknown>): StartSearch => {
      const returnTo = validReturnTo(search['returnTo']);
      return returnTo === undefined ? {} : { returnTo };
    },
  });

  const start = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: WelcomePage,
  });

  const protectedLayout = createRoute({
    getParentRoute: () => root,
    id: 'signed-in',
    component: () => (
      <RequireSession>
        <Outlet />
      </RequireSession>
    ),
  });

  const home = createRoute({ getParentRoute: () => protectedLayout, path: '/home', component: HomePage });

  return createRouter({
    routeTree: root.addChildren([start, protectedLayout.addChildren([home])]),
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
