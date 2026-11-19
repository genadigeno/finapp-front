// The credit module's pages (blueprint §6): credit checks, loans and credit lines, pay later, and paying a shop.
// Pages that show one application, offer, loan or plan carry its finapp identifier in the path - never the
// customer's - and are not `returnTo` targets.
import { IconCoins } from '@tabler/icons-react';
import { lazy, type ComponentType } from 'react';
import { defineMessages } from 'react-intl';
import type { AppRoute } from '../../platform/routing.ts';

const messages = defineMessages({
  credit: { id: 'nav.credit', defaultMessage: 'Credit' },
});

const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

export const CREDIT_ROUTES: AppRoute[] = [
  {
    path: '/credit',
    access: 'signed-in',
    component: page(() => import('./CreditPage.tsx'), 'CreditPage'),
    nav: { label: messages.credit, icon: IconCoins, order: 18 },
    returnable: true,
  },
  {
    path: '/credit/check',
    access: 'signed-in',
    component: page(() => import('./CreditCheckPage.tsx'), 'CreditCheckPage'),
    returnable: true,
  },
  {
    path: '/credit/checks/$requestId',
    access: 'signed-in',
    component: page(() => import('./CreditCheckStatusPage.tsx'), 'CreditCheckStatusPage'),
  },
  {
    path: '/credit/apply',
    access: 'signed-in',
    component: page(() => import('./LoanApplyPage.tsx'), 'LoanApplyPage'),
    returnable: true,
  },
  {
    path: '/credit/applications/$applicationId',
    access: 'signed-in',
    component: page(() => import('./ApplicationStatusPage.tsx'), 'LoanApplicationPage'),
  },
  {
    path: '/credit/offers/$offerId',
    access: 'signed-in',
    component: page(() => import('./OfferPage.tsx'), 'LoanOfferPage'),
  },
  {
    path: '/credit/loans/$loanId',
    access: 'signed-in',
    component: page(() => import('./LoanPage.tsx'), 'LoanPage'),
  },
  {
    path: '/credit/loans/$loanId/repay',
    access: 'signed-in',
    component: page(() => import('./RepayPage.tsx'), 'LoanRepayPage'),
  },
  {
    path: '/credit/loans/$loanId/payoff',
    access: 'signed-in',
    component: page(() => import('./PayoffPage.tsx'), 'LoanPayoffPage'),
  },
  {
    path: '/credit/loans/$loanId/draw',
    access: 'signed-in',
    component: page(() => import('./DrawPage.tsx'), 'DrawPage'),
  },
  {
    path: '/credit/pay-later/$agreementId',
    access: 'signed-in',
    component: page(() => import('./BnplAgreementPage.tsx'), 'BnplAgreementPage'),
  },
  {
    path: '/credit/pay-later/$agreementId/repay',
    access: 'signed-in',
    component: page(() => import('./RepayPage.tsx'), 'BnplRepayPage'),
  },
  {
    path: '/credit/pay-later/$agreementId/payoff',
    access: 'signed-in',
    component: page(() => import('./PayoffPage.tsx'), 'BnplPayoffPage'),
  },
  {
    path: '/credit/pay-later/$agreementId/dispute',
    access: 'signed-in',
    component: page(() => import('./DisputePage.tsx'), 'DisputePage'),
  },
  {
    path: '/credit/pay-later/applications/$applicationId',
    access: 'signed-in',
    component: page(() => import('./ApplicationStatusPage.tsx'), 'BnplApplicationPage'),
  },
  {
    path: '/credit/pay-later/offers/$offerId',
    access: 'signed-in',
    component: page(() => import('./OfferPage.tsx'), 'BnplOfferPage'),
  },
  {
    // The checkout code is typed in on the page, never carried in this path or its query.
    path: '/checkout',
    access: 'signed-in',
    component: page(() => import('./CheckoutPage.tsx'), 'CheckoutPage'),
    returnable: true,
  },
];
