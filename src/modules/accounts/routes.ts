// The accounts module's pages (blueprint §6): accounts and their balances, opening and closing, statements,
// and the customer's transfer and payment history.
import { IconListDetails, IconWallet } from '@tabler/icons-react';
import { lazy } from 'react';
import { defineMessages } from 'react-intl';
import type { AppRoute } from '../../platform/routing.ts';

const messages = defineMessages({
  accounts: { id: 'nav.accounts', defaultMessage: 'Accounts' },
  activity: { id: 'nav.activity', defaultMessage: 'Activity' },
});

export const ACCOUNTS_ROUTES: AppRoute[] = [
  {
    path: '/accounts',
    access: 'signed-in',
    component: lazy(() => import('./AccountsPage.tsx').then((m) => ({ default: m.AccountsPage }))),
    nav: { label: messages.accounts, icon: IconWallet, order: 10 },
    returnable: true,
  },
  {
    path: '/accounts/open',
    access: 'signed-in',
    component: lazy(() => import('./OpenAccountPage.tsx').then((m) => ({ default: m.OpenAccountPage }))),
    returnable: true,
  },
  {
    // An identifier in the path: never a returnTo target (ADR-F07 decision 7).
    path: '/accounts/$accountId',
    access: 'signed-in',
    component: lazy(() => import('./AccountPage.tsx').then((m) => ({ default: m.AccountPage }))),
  },
  {
    path: '/accounts/$accountId/statement',
    access: 'signed-in',
    component: lazy(() => import('./StatementPage.tsx').then((m) => ({ default: m.StatementPage }))),
  },
  {
    path: '/activity',
    access: 'signed-in',
    component: lazy(() => import('./ActivityPage.tsx').then((m) => ({ default: m.ActivityPage }))),
    nav: { label: messages.activity, icon: IconListDetails, order: 20 },
    returnable: true,
  },
];
