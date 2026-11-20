// The FX and cross-border module's pages (blueprint §6), reached from Move money.
import { lazy } from 'react';
import type { AppRoute } from '../../platform/routing.ts';

export const FX_CROSSBORDER_ROUTES: AppRoute[] = [
  {
    path: '/exchange',
    access: 'signed-in',
    component: lazy(() => import('./ExchangePage.tsx').then((m) => ({ default: m.ExchangePage }))),
    returnable: true,
  },
  {
    path: '/exchange/conversions/$tradeId',
    access: 'signed-in',
    component: lazy(() => import('./ConversionReceiptPage.tsx').then((m) => ({ default: m.ConversionReceiptPage }))),
  },
  {
    path: '/send-abroad',
    access: 'signed-in',
    component: lazy(() => import('./SendAbroadPage.tsx').then((m) => ({ default: m.SendAbroadPage }))),
    returnable: true,
  },
  {
    path: '/send-abroad/send',
    access: 'signed-in',
    component: lazy(() => import('./SendAbroadFlowPage.tsx').then((m) => ({ default: m.SendAbroadFlowPage }))),
    returnable: true,
  },
  {
    path: '/send-abroad/payments/$paymentId',
    access: 'signed-in',
    component: lazy(() => import('./CrossBorderPaymentPage.tsx').then((m) => ({ default: m.CrossBorderPaymentPage }))),
  },
];
