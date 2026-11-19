import type { Page, Route } from '@playwright/test';

// A SCRIPTED finapp for the application sweep (P18-TSK-038, -039): every read the application makes, answered
// with values shaped as finapp's contract at 5227f57e2 shapes them, so every signed-in page can be opened in the
// real production build, under the real headers. Demonstration data for a test - never product data. Commands
// other than sign-in are not answered (404): the sweep looks at pages, it does not move money.

export const IDS = {
  account: '0190a3c1-acc0-7222-8333-444455556666',
  payment: 'pi-1',
  withdrawal: 'w-1',
  xbPayment: 'xp-1',
  request: 'cr-1',
  application: 'ap-1',
  offer: 'of-1',
  loan: 'ln-1',
  line: 'ln-2',
  agreement: 'ag-1',
  bnplApplication: 'ba-1',
  bnplOffer: 'bo-1',
} as const;

const later = () => new Date(Date.now() + 20 * 60_000).toISOString();

const DOCUMENT = [
  'PERSONAL LOAN AGREEMENT (demonstration text)',
  '1. Amount of credit: EUR 3,000.00',
  '2. Duration: 12 months',
  '3. Borrowing rate: 7.90% a year, fixed',
  ...Array.from({ length: 30 }, (_, i) => `${i + 4}. Demonstration clause ${i + 4}.`),
].join('\n');

const LOAN = {
  loanId: IDS.loan,
  product: 'PERSONAL_LOAN',
  kind: 'INSTALMENT',
  status: 'ACTIVE',
  currency: 'EUR',
  openedAt: '2026-11-05T09:00:00Z',
  agreement: { nominalAnnualRate: '0.0790', repaymentDay: 5, termMonths: 12 },
  balances: {
    principalOutstanding: '2759.16',
    principalDue: '0.00',
    interestDue: '0.00',
    feesDue: '0.00',
    interestAccrued: '3.10',
    creditBalance: '0.00',
  },
  condition: { delinquency: 'CURRENT', daysPastDue: 0, defaulted: false, drawsSuspended: false },
};
const LINE = {
  ...LOAN,
  loanId: IDS.line,
  product: 'CREDIT_LINE',
  kind: 'REVOLVING',
  availableLimit: '1500.00',
  agreement: { nominalAnnualRate: '0.1450', repaymentDay: 1, limit: '2000.00' },
};
const INSTALMENTS = ['2026-12-05', '2027-01-05', '2027-02-05', '2027-03-05'].map((dueDate, i) => ({
  sequence: i + 1,
  dueDate,
  amount: '260.84',
  instalment: '260.84',
  principal: '241.09',
  interest: '19.75',
  status: i === 0 ? 'DUE' : 'UNBILLED',
}));

/** `METHOD /path` (exact) → body. */
const READS: Record<string, unknown> = {
  'GET /v1/me': {
    partyId: '0190a3c1-p000-7222-8333-444455556666',
    kind: 'PERSON',
    displayName: 'Ada Lovelace',
    loginIdentifier: 'ada.l',
    registeredAt: '2026-11-01T09:00:00Z',
  },
  'GET /v1/me/kyc': { status: 'APPROVED' },
  'GET /v1/me/consents': [
    { purpose: 'KYC_PROCESSING', granted: true, currentTextVersion: 3, currentText: 'We check your identity.' },
    {
      purpose: 'CREDIT_BUREAU_ACCESS',
      granted: false,
      currentTextVersion: 1,
      currentText: 'We check your credit history.',
    },
  ],
  'GET /v1/me/accounts': [
    { id: IDS.account, productType: 'WALLET', status: 'ACTIVE', openedAt: '2026-11-01T09:00:00Z' },
  ],
  [`GET /v1/me/accounts/${IDS.account}/balances`]: {
    accountId: IDS.account,
    kind: 'PROJECTION',
    balances: [
      { currency: 'EUR', settled: '1250.00', holds: '70.00', available: '1180.00' },
      { currency: 'JPY', settled: '98000', holds: '0', available: '98000' },
    ],
  },
  [`GET /v1/me/accounts/${IDS.account}/statement`]: {
    accountId: IDS.account,
    kind: 'DERIVED',
    sections: [
      {
        currency: 'EUR',
        opening: '100.00',
        closing: '130.00',
        lines: [
          {
            entryId: 'e-1',
            postingDate: '2026-11-03',
            valueDate: '2026-11-03',
            entryType: 'POSTING',
            direction: 'CREDIT',
            amount: '50.00',
            reference: 't-123',
          },
          {
            entryId: 'e-2',
            postingDate: '2026-11-04',
            valueDate: '2026-11-05',
            entryType: 'REVERSAL',
            direction: 'DEBIT',
            amount: '20.00',
            reference: 't-123',
          },
        ],
      },
    ],
  },
  'GET /v1/transfers': [
    {
      id: 't-1',
      amount: '20.00',
      currency: 'EUR',
      status: 'COMPLETED',
      reference: 'Rent',
      createdAt: '2026-11-18T10:00:00Z',
    },
  ],
  'GET /v1/payments': [
    { id: IDS.payment, amount: '100.00', currency: 'EUR', status: 'SUCCEEDED', createdAt: '2026-11-16T10:00:00Z' },
  ],
  [`GET /v1/payments/${IDS.payment}`]: { id: IDS.payment, amount: '100.00', currency: 'EUR', status: 'SUCCEEDED' },
  [`GET /v1/me/withdrawals/${IDS.withdrawal}`]: {
    id: IDS.withdrawal,
    amount: '50.00',
    currency: 'EUR',
    status: 'COMPLETED',
  },
  'GET /v1/beneficiaries': [
    {
      id: 'b-1',
      displayName: 'Grace',
      destinationAccountId: '0190a3c1-dddd-7222-8333-444455556666',
      createdAt: '2026-11-18T10:00:00Z',
    },
  ],
  'GET /v1/me/payment-methods': [
    { id: 'pm-card', kind: 'CARD_TOKEN', brand: 'Visa', displaySuffix: '4242', expiryMonth: 4, expiryYear: 2029 },
    { id: 'pm-bank', kind: 'BANK_ACCOUNT', displaySuffix: '0012', payeeCheck: 'MATCH' },
  ],
  'GET /v1/me/fx/pairs': {
    pairs: [
      {
        sourceCurrency: 'EUR',
        destinationCurrency: 'USD',
        available: true,
        sourceMinimum: '1.00',
        sourceMaximum: '10000.00',
        destinationMinimum: '1.00',
        destinationMaximum: '10000.00',
      },
    ],
    truncated: false,
  },
  'GET /v1/me/cross-border/corridors': {
    corridors: [
      {
        corridor: 'EUR-USD-US',
        source: 'EUR',
        destination: 'USD',
        country: 'US',
        feeFixed: '2.00',
        feeMargin: '0.005',
        maximum: '5000.00',
        deliveryEstimateHours: 48,
      },
    ],
    truncated: false,
  },
  'GET /v1/me/cross-border/beneficiaries': {
    beneficiaries: [
      {
        id: 'xb-1',
        nickname: 'Mum',
        suffix: '7788',
        country: 'US',
        currency: 'USD',
        entityType: 'INDIVIDUAL',
        status: 'ACTIVE',
      },
    ],
    truncated: false,
  },
  [`GET /v1/me/cross-border/payments/${IDS.xbPayment}`]: {
    paymentId: IDS.xbPayment,
    status: 'DELIVERED',
    cancellationRequested: false,
  },
  'GET /v1/sessions': [
    { id: 's-1', current: true, device: 'Edge on Windows', issuedAt: '2026-11-19T09:00:00Z', assurance: 'PASSWORD' },
    {
      id: 's-2',
      current: false,
      device: 'Firefox on Android',
      issuedAt: '2026-11-18T19:00:00Z',
      assurance: 'MULTI_FACTOR',
    },
  ],
  'GET /v1/me/credit/profile': {
    sources: [{ sourceKind: 'BUREAU', retrievedAt: '2026-11-10T09:00:00Z' }],
    decisions: [
      { requestId: IDS.request, product: 'PERSONAL_LOAN', outcome: 'APPROVED', validUntil: '2026-12-10T09:00:00Z' },
    ],
  },
  [`GET /v1/me/credit/decision-requests/${IDS.request}`]: {
    requestId: IDS.request,
    product: 'PERSONAL_LOAN',
    status: 'DECIDED',
    outcome: 'APPROVED',
    approvedAmount: '4000.00',
    approvedTermMonths: 24,
    currency: 'EUR',
    validUntil: '2026-12-10T09:00:00Z',
  },
  [`GET /v1/me/loan-applications/${IDS.application}`]: {
    applicationId: IDS.application,
    product: 'PERSONAL_LOAN',
    status: 'OFFERED',
    offerId: IDS.offer,
  },
  [`GET /v1/me/loan-offers/${IDS.offer}`]: {
    offerId: IDS.offer,
    applicationId: IDS.application,
    product: 'PERSONAL_LOAN',
    status: 'OFFERED',
    currency: 'EUR',
    amount: '3000.00',
    termMonths: 12,
    nominalAnnualRate: '0.0790',
    expiresAt: '2026-12-01T10:00:00Z',
    termsSha256: 'a'.repeat(64),
    document: DOCUMENT,
    illustration: {
      instalment: '260.84',
      finalInstalment: '260.80',
      firstDueDate: '2026-12-05',
      totalInterest: '130.04',
      totalPayable: '3130.04',
      periods: INSTALMENTS,
    },
  },
  'GET /v1/me/loans': { loans: [LOAN, LINE] },
  [`GET /v1/me/loans/${IDS.loan}`]: LOAN,
  [`GET /v1/me/loans/${IDS.line}`]: LINE,
  [`GET /v1/me/loans/${IDS.loan}/schedule`]: { instalments: INSTALMENTS, totalPayable: '3130.04', currency: 'EUR' },
  [`GET /v1/me/loans/${IDS.loan}/repayments`]: {
    repayments: [{ repaymentId: 'r-1', amount: '260.84', currency: 'EUR', valueDate: '2026-11-05' }],
  },
  [`GET /v1/me/loans/${IDS.line}/repayments`]: { repayments: [] },
  [`GET /v1/me/loans/${IDS.line}/statements`]: {
    statements: [
      {
        statementId: 'st-1',
        statementDate: '2026-11-01',
        closingBalance: '500.00',
        minimumPayment: '25.00',
        dueDate: '2026-11-22',
        currency: 'EUR',
      },
    ],
  },
  'GET /v1/me/bnpl-agreements': {
    agreements: [
      {
        agreementId: IDS.agreement,
        product: 'BNPL_PAY_IN_4',
        plan: 'PAY_IN_4',
        status: 'ACTIVE',
        currency: 'EUR',
        amount: '200.00',
        purchaseDate: '2026-11-02',
        owed: { principalOutstanding: '150.00' },
      },
    ],
  },
  [`GET /v1/me/bnpl-agreements/${IDS.agreement}`]: {
    agreementId: IDS.agreement,
    product: 'BNPL_PAY_IN_4',
    plan: 'PAY_IN_4',
    status: 'ACTIVE',
    currency: 'EUR',
    amount: '200.00',
    purchaseDate: '2026-11-02',
    balances: { principalOutstanding: '150.00', principalDue: '50.00', interestDue: '0.00', feesDue: '0.00' },
    condition: { delinquency: 'CURRENT', daysPastDue: 0 },
  },
  [`GET /v1/me/bnpl-agreements/${IDS.agreement}/schedule`]: {
    instalments: [
      { sequence: 1, dueDate: '2026-11-02', amount: '50.00', paid: '50.00', due: '0.00' },
      { sequence: 2, dueDate: '2026-12-02', amount: '50.00', paid: '0.00', due: '50.00' },
    ],
  },
  [`GET /v1/me/bnpl-agreements/${IDS.agreement}/repayments`]: { repayments: [] },
  [`GET /v1/me/bnpl-applications/${IDS.bnplApplication}`]: {
    applicationId: IDS.bnplApplication,
    product: 'BNPL_PAY_IN_4',
    plan: 'PAY_IN_4',
    status: 'OFFERED',
    offerId: IDS.bnplOffer,
  },
  [`GET /v1/me/bnpl-offers/${IDS.bnplOffer}`]: () => ({
    offerId: IDS.bnplOffer,
    product: 'BNPL_PAY_IN_4',
    plan: 'PAY_IN_4',
    status: 'OFFERED',
    currency: 'EUR',
    amount: '200.00',
    nominalAnnualRate: '0',
    expiresAt: later(),
    termsSha256: 'b'.repeat(64),
    document: DOCUMENT.replace('PERSONAL LOAN', 'PAY IN 4'),
    illustration: {
      instalmentCount: 4,
      firstInstalment: '50.00',
      regularInstalment: '50.00',
      totalInterest: '0.00',
      totalPayable: '200.00',
      instalments: INSTALMENTS.map((i) => ({ ...i, amount: '50.00', principal: '50.00', interest: '0.00' })),
    },
  }),
};

const PROBLEM = (status: number, code: string) => ({ type: 'about:blank', title: code, status, code });

let correlation = 0;

async function answer(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const key = `${request.method()} ${url.pathname}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': `0190a3c1-${String(++correlation).padStart(4, '0')}-7222-8333-444455556666`,
    Date: new Date().toUTCString(),
  };
  if (key === 'POST /v1/authentications') {
    return route.fulfill({
      status: 201,
      headers,
      body: JSON.stringify({
        sessionToken: 'demonstration-token',
        assurance: 'PASSWORD',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      }),
    });
  }
  const read = READS[key];
  if (read === undefined) {
    return route.fulfill({
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/problem+json' },
      body: JSON.stringify(PROBLEM(404, 'api.NotFound')),
    });
  }
  const body = typeof read === 'function' ? (read as () => unknown)() : read;
  return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
}

/** Answers every `/v1` request of the page from the script above. */
export async function useFakeFinapp(page: Page): Promise<void> {
  await page.route('**/v1/**', answer);
}

/** Signs in through the real sign-in page; the session then lives in this page's memory (no reload after this). */
export async function signIn(page: Page, app: string): Promise<void> {
  await page.goto(`${app}sign-in`);
  await page.getByLabel('Login name').fill('ada.l');
  await page.getByLabel('Password', { exact: true }).fill('demonstration only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Hello, Ada Lovelace' }).waitFor();
}

/** Moves to `path` inside the application, as a link would - a reload would end the in-memory session. */
export async function goWithin(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, path);
}
