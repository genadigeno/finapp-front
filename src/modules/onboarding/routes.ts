// The onboarding module's pages (blueprint §6): open an account, consents, identity, business.
import { IconBuildingStore } from '@tabler/icons-react';
import { lazy } from 'react';
import { defineMessages } from 'react-intl';
import type { AppRoute } from '../../platform/routing.ts';

const messages = defineMessages({
  business: { id: 'nav.business', defaultMessage: 'Business' },
});

export const ONBOARDING_ROUTES: AppRoute[] = [
  {
    path: '/register',
    access: 'signed-out',
    component: lazy(() => import('./RegisterPage.tsx').then((m) => ({ default: m.RegisterPage }))),
  },
  {
    path: '/onboarding/consents',
    access: 'signed-in',
    component: lazy(() => import('./ConsentsPage.tsx').then((m) => ({ default: m.ConsentsPage }))),
    returnable: true,
  },
  {
    path: '/onboarding/identity',
    access: 'signed-in',
    component: lazy(() => import('./KycPage.tsx').then((m) => ({ default: m.KycPage }))),
    returnable: true,
  },
  {
    path: '/business',
    access: 'signed-in',
    component: lazy(() => import('./BusinessPage.tsx').then((m) => ({ default: m.BusinessPage }))),
    nav: { label: messages.business, icon: IconBuildingStore, order: 50 },
    returnable: true,
  },
];
