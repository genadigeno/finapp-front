// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { fractionToPercent } from '../../design-system/money.ts';
import { endSession } from '../../platform/session/session-store.ts';
import { json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';

afterEach(() => endSession('signed-out'));

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, label: string, option: RegExp | string) {
  const input = (await screen.findAllByLabelText(label)).find((el) => el.tagName === 'INPUT');
  if (input === undefined) throw new Error(`no select ${label}`);
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: option }));
}

const KEY = /^[0-9a-f-]{36}$/;

const LOAN = {
  loanId: 'ln-1',
  product: 'PERSONAL_LOAN',
  kind: 'INSTALMENT',
  status: 'ACTIVE',
  currency: 'EUR',
  agreement: { nominalAnnualRate: '0.0790', repaymentDay: 5, termMonths: 24 },
  balances: {
    principalOutstanding: '4600.00',
    principalDue: '190.00',
    interestDue: '30.28',
    feesDue: '0.00',
    interestAccrued: '3.10',
    creditBalance: '0.00',
  },
  condition: { delinquency: 'CURRENT', daysPastDue: 0, defaulted: false, drawsSuspended: false },
};
const LINE = {
  ...LOAN,
  loanId: 'ln-2',
  product: 'CREDIT_LINE',
  kind: 'REVOLVING',
  availableLimit: '1500.00',
  agreement: { nominalAnnualRate: '0.1450', repaymentDay: 1, limit: '2000.00' },
};

describe('rates by string arithmetic', () => {
  it('a nominal annual rate finapp sends as a fraction is a percentage', () => {
    expect(fractionToPercent('0.0790')).toBe('7.90');
    expect(fractionToPercent('0.1999')).toBe('19.99');
    expect(fractionToPercent('0')).toBe('0.00');
  });
});

describe('credit home (P18-TSK-028)', () => {
  it('lists loans, pay-later plans and current answers, and says what is not listed', async () => {
    signInForTest();
    renderAppAt('/credit', {
      'GET /v1/me/loans': json({ loans: [LOAN] }),
      'GET /v1/me/bnpl-agreements': json({
        agreements: [
          {
            agreementId: 'ag-1',
            product: 'BNPL_PAY_IN_4',
            plan: 'PAY_IN_4',
            status: 'ACTIVE',
            currency: 'EUR',
            amount: '200.00',
            purchaseDate: '2026-11-02',
            owed: { principalOutstanding: '150.00' },
          },
        ],
      }),
      'GET /v1/me/credit/profile': json({
        sources: [{ sourceKind: 'BUREAU', retrievedAt: '2026-11-10T09:00:00Z' }],
        decisions: [
          { requestId: 'cr-1', product: 'CREDIT_LINE', outcome: 'APPROVED', validUntil: '2026-12-10T09:00:00Z' },
        ],
      }),
    });
    expect(await screen.findByText('Personal loan')).toBeTruthy();
    expect(screen.getByText('€4,600.00')).toBeTruthy();
    expect(await screen.findByText(/Pay in 4/)).toBeTruthy();
    expect(screen.getByText('Bought on 2 Nov 2026')).toBeTruthy();
    expect(await screen.findByText('Approved')).toBeTruthy();
    expect(screen.getByText(/still in progress is not listed here/)).toBeTruthy();
  });
});

describe('credit check (P18-TSK-028)', () => {
  it('sends a loan check under a key and follows it to its page', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/credit/check', {
      'POST /v1/me/credit/decision-requests': json({ requestId: 'cr-9', status: 'SUBMITTED' }, 202),
      'GET /v1/me/credit/decision-requests/cr-9': json({ requestId: 'cr-9', status: 'COLLECTING' }),
    });
    await user.type(await screen.findByLabelText('How much?'), '5000');
    await pick(user, 'Over how many months?', '24 months');
    await user.type(screen.getByLabelText('Your monthly income after tax (optional)'), '3200');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Send my request' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/credit/checks/cr-9'));
    expect(await screen.findByText(/We are looking at your request/)).toBeTruthy();
    const request = sent.find((s) => s.path === '/v1/me/credit/decision-requests');
    expect(request?.body).toEqual({
      product: 'PERSONAL_LOAN',
      amount: '5000',
      currency: 'EUR',
      termMonths: 24,
      declaredMonthlyIncome: '3200',
    });
    expect(request?.headers.get('Idempotency-Key')).toMatch(KEY);
  });

  it('a credit line has no term', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/check', {
      'POST /v1/me/credit/decision-requests': json({ requestId: 'cr-9', status: 'SUBMITTED' }, 202),
    });
    await user.click(await screen.findByRole('radio', { name: 'Credit line' }));
    expect(screen.queryByLabelText('Over how many months?')).toBeNull();
    await user.type(screen.getByLabelText('How much?'), '1000');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Send my request' }));
    await waitFor(() =>
      expect(sent.find((s) => s.path === '/v1/me/credit/decision-requests')?.body).toEqual({
        product: 'CREDIT_LINE',
        amount: '1000',
        currency: 'EUR',
      }),
    );
  });

  it('without consent to check credit history, says so and shows the way to consent', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/credit/check', {
      'POST /v1/me/credit/decision-requests': problem(409, 'consent.ConsentRequired'),
    });
    await user.type(await screen.findByLabelText('How much?'), '5000');
    await pick(user, 'Over how many months?', '12 months');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Send my request' }));
    expect(await screen.findByText('Your consent is needed first')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Give your consent to check your credit history' })).toBeTruthy();
  });

  it('an approval shows what finapp approved', async () => {
    signInForTest();
    renderAppAt('/credit/checks/cr-1', {
      'GET /v1/me/credit/decision-requests/cr-1': json({
        requestId: 'cr-1',
        product: 'PERSONAL_LOAN',
        status: 'DECIDED',
        outcome: 'APPROVED',
        approvedAmount: '4000.00',
        approvedTermMonths: 24,
        currency: 'EUR',
        validUntil: '2026-12-19T10:00:00Z',
      }),
    });
    expect(await screen.findByText('€4,000.00')).toBeTruthy();
    expect(screen.getByText('24 months')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Apply now' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).toBeNull();
  });

  it('a decline shows only the reasons finapp gives the customer', async () => {
    signInForTest();
    renderAppAt('/credit/checks/cr-2', {
      'GET /v1/me/credit/decision-requests/cr-2': json({
        requestId: 'cr-2',
        status: 'DECIDED',
        outcome: 'DECLINED',
        reasons: ['Your income is too low for this amount.'],
        statusText: 'score 412 below cut-off 480',
      }),
    });
    expect(await screen.findByText('Your income is too low for this amount.')).toBeTruthy();
    expect(screen.queryByText(/score|cut-off/i)).toBeNull();
  });

  it('a request still being gathered can be cancelled after confirmation', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/checks/cr-3', {
      'GET /v1/me/credit/decision-requests/cr-3': [
        json({ requestId: 'cr-3', status: 'COLLECTING' }),
        json({ requestId: 'cr-3', status: 'CANCELLED' }),
      ],
      'POST /v1/me/credit/decision-requests/cr-3/cancellation': json({ requestId: 'cr-3', status: 'CANCELLED' }),
    });
    await user.click(await screen.findByRole('button', { name: 'Cancel this request' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this credit check?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel this request' }));
    expect(await screen.findByText('You cancelled this request.')).toBeTruthy();
    expect(sent.find((s) => s.path.endsWith('/cancellation'))?.headers.get('Idempotency-Key')).toMatch(KEY);
  });
});

describe('loan application and offer (P18-TSK-029)', () => {
  it('applies with the wallet as payout and repayment, then follows the application', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/credit/apply', {
      'POST /v1/me/loan-applications': json({ applicationId: 'ap-1', status: 'SUBMITTED' }, 202),
      'GET /v1/me/loan-applications/ap-1': json({ applicationId: 'ap-1', status: 'OFFERED', offerId: 'of-1' }),
    });
    await user.type(await screen.findByLabelText('How much?'), '3000');
    await pick(user, 'Over how many months?', '12 months');
    await pick(user, 'Day of the month you repay', 'Day 5');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Send my application' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/credit/applications/ap-1'));
    expect(await screen.findByRole('link', { name: 'See your offer' })).toBeTruthy();
    expect(sent.find((s) => s.path === '/v1/me/loan-applications')?.body).toEqual({
      product: 'PERSONAL_LOAN',
      amount: '3000',
      currency: 'EUR',
      termMonths: 12,
      repaymentDay: 5,
      repaymentMethod: 'WALLET',
      payoutPreference: 'WALLET',
    });
  });

  it('an application waiting for a decision can be withdrawn', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/credit/applications/ap-2', {
      'GET /v1/me/loan-applications/ap-2': [
        json({ applicationId: 'ap-2', status: 'AWAITING_DECISION' }),
        json({ applicationId: 'ap-2', status: 'WITHDRAWN' }),
      ],
      'POST /v1/me/loan-applications/ap-2/withdrawal': json({ applicationId: 'ap-2', status: 'WITHDRAWN' }),
    });
    await user.click(await screen.findByRole('button', { name: 'Withdraw this application' }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw this application?' });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw this application' }));
    expect(await screen.findByText('You withdrew this application.')).toBeTruthy();
  });

  const OFFER = (termsSha256: string, document: string) => ({
    offerId: 'of-1',
    applicationId: 'ap-1',
    product: 'PERSONAL_LOAN',
    status: 'OFFERED',
    currency: 'EUR',
    amount: '3000.00',
    termMonths: 12,
    nominalAnnualRate: '0.0790',
    expiresAt: '2026-12-01T10:00:00Z',
    termsSha256,
    document,
    illustration: {
      instalment: '260.84',
      finalInstalment: '260.80',
      firstDueDate: '2026-12-05',
      totalInterest: '130.04',
      totalPayable: '3130.04',
      periods: [{ sequence: 1, dueDate: '2026-12-05', instalment: '260.84', principal: '241.09', interest: '19.75' }],
    },
  });

  it('shows every figure and the agreement, and accepts only after it is read, echoing the terms hash', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/offers/of-1', {
      'GET /v1/me/loan-offers/of-1': json(OFFER('a'.repeat(64), 'LOAN AGREEMENT v3\nTerms...')),
      'POST /v1/me/loan-offers/of-1/acceptance': json({ loanId: 'ln-9', status: 'PENDING_DISBURSEMENT' }, 201),
    });
    expect(await screen.findByText('7.90% a year (fixed)')).toBeTruthy();
    expect(screen.getAllByText('€260.84').length).toBeGreaterThan(0);
    expect(screen.getByText('€130.04')).toBeTruthy();
    expect(screen.getByText('€3,130.04')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Credit agreement' }).textContent).toContain('LOAN AGREEMENT v3');
    const accept = screen.getByRole('button', { name: 'Accept and sign' }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'I have read the agreement and the figures above' }));
    expect(accept.disabled).toBe(false);
    await user.click(accept);
    expect(await screen.findByText('Your loan is agreed')).toBeTruthy();
    const acceptance = sent.find((s) => s.path.endsWith('/acceptance'));
    expect(acceptance?.body).toEqual({ termsSha256: 'a'.repeat(64) });
    expect(acceptance?.headers.get('Idempotency-Key')).toMatch(KEY);
  });

  it('changed terms are read again before a new acceptance with the new hash', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/offers/of-1', {
      'GET /v1/me/loan-offers/of-1': [
        json(OFFER('a'.repeat(64), 'LOAN AGREEMENT v3')),
        json(OFFER('b'.repeat(64), 'LOAN AGREEMENT v4')),
      ],
      'POST /v1/me/loan-offers/of-1/acceptance': [
        problem(409, 'lending.TermsChanged'),
        json({ loanId: 'ln-9', status: 'PENDING_DISBURSEMENT' }, 201),
      ],
    });
    await user.click(await screen.findByRole('checkbox', { name: /I have read/ }));
    await user.click(screen.getByRole('button', { name: 'Accept and sign' }));
    expect(await screen.findByText('The terms have changed')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Read the agreement' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Credit agreement' }).textContent).toContain('v4'));
    const checkbox = screen.getByRole('checkbox', { name: /I have read/ }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Accept and sign' }));
    expect(await screen.findByText('Your loan is agreed')).toBeTruthy();
    const acceptances = sent.filter((s) => s.path.endsWith('/acceptance'));
    expect(acceptances.map((s) => s.body)).toEqual([{ termsSha256: 'a'.repeat(64) }, { termsSha256: 'b'.repeat(64) }]);
    expect(acceptances[0]?.headers.get('Idempotency-Key')).not.toBe(acceptances[1]?.headers.get('Idempotency-Key'));
  });
});

describe('loan servicing (P18-TSK-029)', () => {
  it('shows what is owed, an overdue payment in days, and the schedule', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-1', {
      'GET /v1/me/loans/ln-1': json({
        ...LOAN,
        condition: { delinquency: 'PAST_DUE', daysPastDue: 6, bucket: 'B1', defaulted: false },
      }),
      'GET /v1/me/loans/ln-1/schedule': json({
        instalments: [{ sequence: 1, dueDate: '2026-12-05', amount: '260.84', status: 'DUE' }],
        totalPayable: '3130.04',
      }),
    });
    expect(await screen.findByText('€4,600.00')).toBeTruthy();
    expect(screen.getByText(/overdue by 6 days/)).toBeTruthy();
    expect(screen.queryByText(/B1|bucket|collections/i)).toBeNull();
    expect(await screen.findByText('€260.84')).toBeTruthy();
    expect(screen.getAllByText('Due')).toHaveLength(2);
  });

  it('a repayment and a prepayment go to their own doors, from the wallet', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/loans/ln-1/repay', {
      'GET /v1/me/loans/ln-1': json(LOAN),
      'POST /v1/me/loans/ln-1/prepayments': json(
        {
          instalment: '220.10',
          nextDueDate: '2026-12-05',
          remainingInstalments: 11,
          repayment: { amount: '500.00', currency: 'EUR' },
        },
        201,
      ),
    });
    await user.click(await screen.findByRole('radio', { name: 'Extra, off what I borrowed' }));
    await user.type(screen.getByLabelText('Amount'), '500');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Repay now' }));
    expect(await screen.findByText('Repayment received')).toBeTruthy();
    expect(screen.getByText('€220.10')).toBeTruthy();
    const prepayment = sent.find((s) => s.path === '/v1/me/loans/ln-1/prepayments');
    expect(prepayment?.body).toEqual({ amount: '500', currency: 'EUR' });
    expect(prepayment?.headers.get('Idempotency-Key')).toMatch(KEY);
    expect(sent.some((s) => s.path === '/v1/me/loans/ln-1/repayments')).toBe(false);
  });

  it('pays off from a quote; a stale quote is asked for again, never paid', async () => {
    const user = userEvent.setup();
    signInForTest();
    const QUOTE = (quoteId: string, amount: string) =>
      json(
        { quoteId, currency: 'EUR', amount, principal: '4600.00', interestAccrued: '3.10', goodThrough: '2026-11-19' },
        201,
      );
    const { sent } = renderAppAt('/credit/loans/ln-1/payoff', {
      'POST /v1/me/loans/ln-1/payoff-quotes': [QUOTE('pq-1', '4603.10'), QUOTE('pq-2', '4603.40')],
      'POST /v1/me/loans/ln-1/payoff': [
        problem(409, 'lending.PayoffQuoteStale'),
        json({ paid: '4603.40', currency: 'EUR', quoteId: 'pq-2' }, 201),
      ],
    });
    await user.click(await screen.findByRole('button', { name: 'Get my payoff amount' }));
    expect(await screen.findByText('€4,603.10')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pay off now' }));
    expect(await screen.findByText('This payoff amount is out of date')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Change the details' }));
    await user.click(await screen.findByRole('button', { name: 'Get my payoff amount' }));
    expect(await screen.findByText('€4,603.40')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pay off now' }));
    expect(await screen.findByText('Paid off')).toBeTruthy();
    expect(sent.filter((s) => s.path === '/v1/me/loans/ln-1/payoff').map((s) => s.body)).toEqual([
      { quoteId: 'pq-1' },
      { quoteId: 'pq-2' },
    ]);
  });

  it('a credit line draws up to its available limit and can be closed', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/loans/ln-2/draw', {
      'GET /v1/me/loans/ln-2': json(LINE),
      'POST /v1/me/loans/ln-2/draws': json({ drawId: 'dr-1', amount: '300.00', currency: 'EUR' }, 201),
    });
    expect(await screen.findByText('€1,500.00')).toBeTruthy();
    await user.type(screen.getByLabelText('Amount'), '300');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Draw now' }));
    expect(await screen.findByText('Money drawn')).toBeTruthy();
    expect(sent.find((s) => s.path.endsWith('/draws'))?.body).toEqual({ amount: '300', currency: 'EUR' });
  });

  it('a suspended line offers no draw and says only that drawing is not possible', async () => {
    signInForTest();
    const { sent } = renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json({ ...LINE, condition: { ...LINE.condition, drawsSuspended: true } }),
      'GET /v1/me/loans/ln-2/repayments': json({ repayments: [] }),
    });
    expect(await screen.findByText('You cannot draw from this credit line at the moment.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Draw money' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close this credit line' })).toBeTruthy();
    // A credit line has no instalment schedule: it is never asked for (found by the Stage 7 browser sweep).
    await waitFor(() => expect(sent.some((s) => s.path.endsWith('/repayments'))).toBe(true));
    expect(sent.some((s) => s.path.endsWith('/schedule'))).toBe(false);
  });
});

describe('pay later (P18-TSK-030)', () => {
  it('opens a dispute and can withdraw it from the same page, the only place finapp lets it be seen', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/pay-later/ag-1/dispute', {
      'GET /v1/me/bnpl-agreements/ag-1': json({
        agreementId: 'ag-1',
        status: 'ACTIVE',
        currency: 'EUR',
        amount: '200.00',
      }),
      'POST /v1/me/bnpl-agreements/ag-1/disputes': json(
        { disputeId: 'dp-1', status: 'OPEN', heldInstalments: 2, responseDeadline: '2026-12-03T10:00:00Z' },
        201,
      ),
      'POST /v1/me/bnpl-disputes/dp-1/withdrawal': json({ disputeId: 'dp-1', status: 'WITHDRAWN' }),
    });
    await user.click(await screen.findByRole('radio', { name: 'I did not receive it' }));
    await user.type(screen.getByLabelText('Amount in dispute'), '200');
    await user.type(screen.getByLabelText('Tell us what happened'), 'The parcel never arrived.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Send to the shop' }));
    expect(await screen.findByText('Your dispute is open')).toBeTruthy();
    expect(screen.getByText('2 payments are paused while it is open.')).toBeTruthy();
    expect(screen.getByText('dp-1')).toBeTruthy();
    expect(sent.find((s) => s.path.endsWith('/disputes'))?.body).toEqual({
      category: 'NOT_RECEIVED',
      amount: '200',
      currency: 'EUR',
      reason: 'The parcel never arrived.',
    });
    await user.click(screen.getByRole('button', { name: 'Withdraw this dispute' }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw this dispute?' });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw this dispute' }));
    expect(await screen.findByText('You withdrew this dispute.')).toBeTruthy();
  });
});

describe('paying a shop (P18-TSK-031)', () => {
  const CODE = 'cs_live_secret_token_0123456789';

  it('pays from the wallet with the code in the body only - never a URL, never a key', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/checkout', {
      'POST /v1/checkout/sessions/bnpl-options': problem(422, 'bnpl.SessionNotEligible'),
      'GET /v1/me/payment-methods': json([]),
      'POST /v1/checkout/sessions/confirmation': json({
        status: 'COMPLETED',
        amount: '42.50',
        currency: 'EUR',
        lineSummary: 'Two books',
      }),
    });
    await user.type(await screen.findByLabelText('Checkout code'), CODE);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('radio', { name: 'From my wallet' }));
    expect(screen.queryByRole('radio', { name: /Pay later/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Pay now' }));
    expect(await screen.findByRole('heading', { name: 'Paid' })).toBeTruthy();
    expect(screen.getByText('Two books')).toBeTruthy();
    expect(screen.getByText('€42.50')).toBeTruthy();
    const confirmation = sent.find((s) => s.path === '/v1/checkout/sessions/confirmation');
    expect(confirmation?.body).toEqual({ sessionToken: CODE, instrument: 'WALLET' });
    expect(confirmation?.headers.get('Idempotency-Key')).toBeNull();
    expect(router.state.location.href).not.toContain(CODE);
    expect(sent.every((s) => !s.path.includes(CODE))).toBe(true);
  });

  it('offers the shop’s pay-later plans and applies under a key, then follows the application', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/checkout', {
      'POST /v1/checkout/sessions/bnpl-options': json({
        products: [
          {
            product: 'BNPL_PAY_IN_4',
            termsVersion: 2,
            plans: [
              {
                plan: 'PAY_IN_4',
                illustration: {
                  instalmentCount: 4,
                  regularInstalment: '50.00',
                  totalPayable: '200.00',
                  totalInterest: '0.00',
                },
              },
            ],
          },
        ],
      }),
      'GET /v1/me/payment-methods': json([]),
      'POST /v1/me/bnpl-applications': json({ applicationId: 'ba-1', status: 'SUBMITTED' }, 202),
      'GET /v1/me/bnpl-applications/ba-1': json({ applicationId: 'ba-1', status: 'AWAITING_DECISION' }),
    });
    await user.type(await screen.findByLabelText('Checkout code'), CODE);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('radio', { name: 'Pay later: Pay in 4' }));
    expect(screen.getByText('4 payments of €50.00')).toBeTruthy();
    expect(screen.getByText('€200.00')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Apply to pay later' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/credit/pay-later/applications/ba-1'));
    const application = sent.find((s) => s.path === '/v1/me/bnpl-applications');
    expect(application?.body).toEqual({ sessionToken: CODE, product: 'BNPL_PAY_IN_4', plan: 'PAY_IN_4' });
    expect(application?.headers.get('Idempotency-Key')).toMatch(KEY);
  });
});
