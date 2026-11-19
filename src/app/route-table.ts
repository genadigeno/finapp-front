// Every page of the application, by module (blueprint §9). A module adds its pages by exporting a route
// list; the order here is the order of the main navigation's groups.
import { IconHome } from '@tabler/icons-react';
import { lazy } from 'react';
import { defineMessages } from 'react-intl';
import { ACCOUNTS_ROUTES } from '../modules/accounts/routes.ts';
import { CREDIT_ROUTES } from '../modules/credit/routes.ts';
import { FX_CROSSBORDER_ROUTES } from '../modules/fx-crossborder/routes.ts';
import { MOVE_MONEY_ROUTES } from '../modules/move-money/routes.ts';
import { ONBOARDING_ROUTES } from '../modules/onboarding/routes.ts';
import { PROFILE_ROUTES } from '../modules/profile/routes.ts';
import { SECURITY_ROUTES } from '../modules/security/routes.ts';
import { WelcomePage } from './pages/WelcomePage.tsx';
import { setReturnablePaths } from '../platform/return-to.ts';
import type { AppRoute } from '../platform/routing.ts';

const messages = defineMessages({
  home: { id: 'nav.home', defaultMessage: 'Home' },
});

const APP_ROUTES: AppRoute[] = [
  {
    path: '/',
    access: 'public',
    // The start page is the first thing a new visitor sees: it travels with the entry (1 KB) rather than as a chunk
    // fetched after the entry has run - one round trip less before the first paint (Stage 7, LCP budget).
    component: WelcomePage,
  },
  {
    path: '/home',
    access: 'signed-in',
    component: lazy(() => import('./pages/HomePage.tsx').then((m) => ({ default: m.HomePage }))),
    nav: { label: messages.home, icon: IconHome, order: 0 },
    returnable: true,
  },
];

export const ROUTES: readonly AppRoute[] = [
  ...APP_ROUTES,
  ...ACCOUNTS_ROUTES,
  ...MOVE_MONEY_ROUTES,
  ...FX_CROSSBORDER_ROUTES,
  ...CREDIT_ROUTES,
  ...ONBOARDING_ROUTES,
  ...SECURITY_ROUTES,
  ...PROFILE_ROUTES,
];

setReturnablePaths(ROUTES.filter((route) => route.returnable === true).map((route) => route.path));
