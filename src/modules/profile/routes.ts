// The profile module's pages (blueprint §6): the customer's details, reached from the security centre. Consents
// live with onboarding (/onboarding/consents), where they are first given; the security centre links both.
import { lazy } from 'react';
import type { AppRoute } from '../../platform/routing.ts';

export const PROFILE_ROUTES: AppRoute[] = [
  {
    path: '/profile',
    access: 'signed-in',
    component: lazy(() => import('./ProfilePage.tsx').then((m) => ({ default: m.ProfilePage }))),
    returnable: true,
  },
];
