// The security module's pages (blueprint §6): sign-in, two-step verification, signed-in devices.
import { IconShieldLock } from '@tabler/icons-react';
import { lazy } from 'react';
import { defineMessages } from 'react-intl';
import type { AppRoute } from '../../platform/routing.ts';

const messages = defineMessages({
  security: { id: 'nav.security', defaultMessage: 'Security' },
});

export const SECURITY_ROUTES: AppRoute[] = [
  {
    path: '/sign-in',
    access: 'signed-out',
    component: lazy(() => import('./SignInPage.tsx').then((m) => ({ default: m.SignInPage }))),
  },
  {
    path: '/security',
    access: 'signed-in',
    component: lazy(() => import('./SecurityPage.tsx').then((m) => ({ default: m.SecurityPage }))),
    nav: { label: messages.security, icon: IconShieldLock, order: 90 },
    returnable: true,
  },
  {
    path: '/security/two-step',
    access: 'signed-in',
    component: lazy(() => import('./MfaPage.tsx').then((m) => ({ default: m.MfaPage }))),
    returnable: true,
  },
  {
    path: '/security/devices',
    access: 'signed-in',
    component: lazy(() => import('./SessionsPage.tsx').then((m) => ({ default: m.SessionsPage }))),
    returnable: true,
  },
  {
    path: '/security/password',
    access: 'signed-in',
    component: lazy(() => import('./PasswordPage.tsx').then((m) => ({ default: m.PasswordPage }))),
    returnable: true,
  },
];
