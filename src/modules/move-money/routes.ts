// The move-money module's pages (blueprint §6): send, recipients, top-up, withdraw, payment methods, and the status
// pages of what is still in progress.
import { IconArrowsRightLeft } from '@tabler/icons-react';
import { lazy } from 'react';
import { defineMessages } from 'react-intl';
import type { AppRoute } from '../../platform/routing.ts';

const messages = defineMessages({
  move: { id: 'nav.move', defaultMessage: 'Move money' },
});

export const MOVE_MONEY_ROUTES: AppRoute[] = [
  {
    path: '/move',
    access: 'signed-in',
    component: lazy(() => import('./MoveMoneyPage.tsx').then((m) => ({ default: m.MoveMoneyPage }))),
    nav: { label: messages.move, icon: IconArrowsRightLeft, order: 15 },
    returnable: true,
  },
  {
    path: '/move/send',
    access: 'signed-in',
    component: lazy(() => import('./SendPage.tsx').then((m) => ({ default: m.SendPage }))),
    returnable: true,
  },
  {
    path: '/move/recipients',
    access: 'signed-in',
    component: lazy(() => import('./RecipientsPage.tsx').then((m) => ({ default: m.RecipientsPage }))),
    returnable: true,
  },
  {
    path: '/move/top-up',
    access: 'signed-in',
    component: lazy(() => import('./TopUpPage.tsx').then((m) => ({ default: m.TopUpPage }))),
    returnable: true,
  },
  {
    path: '/move/top-ups/$paymentId',
    access: 'signed-in',
    component: lazy(() => import('./TopUpStatusPage.tsx').then((m) => ({ default: m.TopUpStatusPage }))),
  },
  {
    path: '/move/withdraw',
    access: 'signed-in',
    component: lazy(() => import('./WithdrawPage.tsx').then((m) => ({ default: m.WithdrawPage }))),
    returnable: true,
  },
  {
    path: '/move/withdrawals/$withdrawalId',
    access: 'signed-in',
    component: lazy(() => import('./WithdrawalStatusPage.tsx').then((m) => ({ default: m.WithdrawalStatusPage }))),
  },
  {
    path: '/move/payment-methods',
    access: 'signed-in',
    component: lazy(() => import('./PaymentMethodsPage.tsx').then((m) => ({ default: m.PaymentMethodsPage }))),
    returnable: true,
  },
];
