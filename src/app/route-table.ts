// Every page of the application, by module (blueprint §9). A module adds its pages by exporting a route
// list; the order here is the order of the main navigation's groups.
import { IconHome } from '@tabler/icons-react';
import { lazy } from 'react';
import { defineMessages } from 'react-intl';
import { ACCOUNTS_ROUTES } from '../modules/accounts/routes.ts';
import { ONBOARDING_ROUTES } from '../modules/onboarding/routes.ts';
import { SECURITY_ROUTES } from '../modules/security/routes.ts';
import { setReturnablePaths } from '../platform/return-to.ts';
import type { AppRoute } from '../platform/routing.ts';

const messages = defineMessages({
  home: { id: 'nav.home', defaultMessage: 'Home' },
});

const APP_ROUTES: AppRoute[] = [
  {
    path: '/',
    access: 'public',
    component: lazy(() => import('./pages/WelcomePage.tsx').then((m) => ({ default: m.WelcomePage }))),
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
  ...ONBOARDING_ROUTES,
  ...SECURITY_ROUTES,
];

setReturnablePaths(ROUTES.filter((route) => route.returnable === true).map((route) => route.path));
