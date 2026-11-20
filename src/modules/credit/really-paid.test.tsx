// @vitest-environment jsdom
// WP-3: what was really paid - repayment status and breakdown, statement and billing detail, condition, closures.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { endSession } from '../../platform/session/session-store.ts';
import { json, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';
import { isZeroAmount } from './ServicingParts.tsx';

afterEach(() => endSession('signed-out'));

const LOAN = {
  loanId: 'ln-1',
  product: 'PERSONAL_LOAN',
  kind: 'INSTALMENT',
  status: 'ACTIVE',
  currency: 'EUR',
  agreement: { nominalAnnualRate: '0.0790', repaymentDay: 5, termMonths: 24 },
  balances: { principalOutstanding: '4600.00' },
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

const REPAID = {
  repaymentId: 'rp-1',
  kind: 'CUSTOMER',
  status: 'ALLOCATED',
  amount: '100.00',
  currency: 'EUR',
  valueDate: '2026-11-05',
  allocations: [
    { target: 'DUE_ITEM', component: 'INTEREST', amount: '10.00' },
    { target: 'DUE_ITEM', component: 'PRINCIPAL', amount: '88.00' },
    { target: 'CREDIT_BALANCE', amount: '2.00' },
  ],
};
const REVERSED = {
  repaymentId: 'rp-2',
  kind: 'AUTO_COLLECTION',
  status: 'REVERSED',
  amount: '50.00',
  currency: 'EUR',
  valueDate: '2026-11-01',
  allocations: [{ target: 'DUE_ITEM', component: 'FEES', amount: '50.00' }],
};

describe('zero by text, never arithmetic', () => {
  it('knows a zero decimal string', () => {
    expect(isZeroAmount('0')).toBe(true);
    expect(isZeroAmount('0.00')).toBe(true);
    expect(isZeroAmount('0.01')).toBe(false);
    expect(isZeroAmount('15.00')).toBe(false);
    expect(isZeroAmount('')).toBe(false);
  });
});

describe('repayment history (WP-3 a)', () => {
  it('a reversed repayment reads reversed and not counted as paid, never as paid', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json(LINE),
      'GET /v1/me/loans/ln-2/repayments': json({ repayments: [REPAID, REVERSED] }),
    });
    expect(await screen.findByText('Reversed - not counted as paid')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('You paid')).toBeTruthy();
    expect(screen.getByText('Collected automatically')).toBeTruthy();
    expect(screen.queryByText('Paid')).toBeNull();
    // No client-made total of what was repaid.
    expect(screen.queryByText('€150.00')).toBeNull();
  });

  it('a repayment opens to how finapp used it, line by line, with a closure refund', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json(LINE),
      'GET /v1/me/loans/ln-2/repayments': json({
        repayments: [{ ...REPAID, kind: 'PAYOFF', closure: { reason: 'PAID_OFF_EARLY', refunded: '2.00' } }],
      }),
    });
    expect(await screen.findByText('Paid off in full')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Show details' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Interest')).toBeTruthy();
    expect(screen.getByText('€10.00')).toBeTruthy();
    expect(screen.getByText('Borrowed amount')).toBeTruthy();
    expect(screen.getByText('€88.00')).toBeTruthy();
    expect(screen.getByText('Kept as credit in your favour')).toBeTruthy();
    expect(screen.getByText('Refunded to you when the account closed: €2.00')).toBeTruthy();
  });

  it('an unknown kind and status read neutrally - in progress, never paid', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json(LINE),
      'GET /v1/me/loans/ln-2/repayments': json({ repayments: [{ ...REPAID, kind: 'NEW_KIND', status: 'NEW_STATE' }] }),
    });
    expect(await screen.findByText('In progress - check back')).toBeTruthy();
    expect(screen.getByText('Payment')).toBeTruthy();
    expect(screen.queryByText(/NEW_KIND|NEW_STATE/)).toBeNull();
    expect(screen.queryByText('Paid')).toBeNull();
  });

  it('history is read again after a repayment, so a reversal shows', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json(LINE),
      'GET /v1/me/loans/ln-2/repayments': [
        json({ repayments: [REPAID] }),
        json({ repayments: [{ ...REPAID, status: 'REVERSED' }] }),
      ],
      'POST /v1/me/loans/ln-2/repayments': json({ amount: '20.00', currency: 'EUR' }, 201),
    });
    expect(await screen.findByText('Received')).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Make a repayment' }));
    await user.type(await screen.findByLabelText('Amount'), '20');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Repay now' }));
    await user.click(await screen.findByRole('button', { name: 'Back to your loan' }));
    expect(await screen.findByText('Reversed - not counted as paid')).toBeTruthy();
    expect(sent.filter((s) => s.method === 'GET' && s.path.endsWith('/repayments')).length).toBeGreaterThan(1);
  });
});

describe('what can be done, by status (WP-3 c)', () => {
  it('a closing credit line offers repay and pay off, but not draw or close', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json({ ...LINE, status: 'CLOSING' }),
      'GET /v1/me/loans/ln-2/repayments': json({ repayments: [] }),
    });
    expect(await screen.findByRole('link', { name: 'Make a repayment' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pay off in full' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Draw money' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close this credit line' })).toBeNull();
  });

  it.each(['WRITTEN_OFF', 'CLOSED', 'CANCELLED', 'PENDING_DISBURSEMENT'])(
    'a %s account offers nothing that moves money',
    async (status) => {
      signInForTest();
      renderAppAt('/credit/loans/ln-2', {
        'GET /v1/me/loans/ln-2': json({ ...LINE, status }),
        'GET /v1/me/loans/ln-2/repayments': json({ repayments: [] }),
      });
      expect(await screen.findByText('No repayments yet')).toBeTruthy();
      for (const name of ['Make a repayment', 'Pay off in full', 'Draw money']) {
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
      expect(screen.queryByRole('button', { name: 'Close this credit line' })).toBeNull();
    },
  );

  it('an extra payment is offered only on an active instalment loan', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-1/repay', { 'GET /v1/me/loans/ln-1': json({ ...LOAN, status: 'WRITTEN_OFF' }) });
    expect(await screen.findByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Extra, off what I borrowed' })).toBeNull();
  });
});

describe('statements and billing detail (WP-3 b, d)', () => {
  it('statements show their status, what was paid and what is still to pay, and open to finapp’s billing', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/credit/loans/ln-2', {
      'GET /v1/me/loans/ln-2': json(LINE),
      'GET /v1/me/loans/ln-2/repayments': json({ repayments: [] }),
      'GET /v1/me/loans/ln-2/statements': json({
        statements: [
          {
            statementId: 'st-1',
            statementDate: '2026-11-01',
            dueDate: '2026-11-21',
            status: 'PARTIALLY_PAID',
            currency: 'EUR',
            openingBalance: '480.00',
            closingBalance: '512.00',
            minimumPayment: '25.00',
            paid: '15.00',
            outstanding: '10.00',
            interestBilled: '6.40',
            interestWaived: '1.20',
          },
        ],
      }),
    });
    await user.click(await screen.findByRole('tab', { name: 'Statements' }));
    expect(await screen.findByText('Partly paid')).toBeTruthy();
    expect(screen.getByText('€15.00')).toBeTruthy();
    expect(screen.getByText('€10.00')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Opening balance')).toBeTruthy();
    expect(screen.getByText('€480.00')).toBeTruthy();
    expect(screen.getByText('€6.40')).toBeTruthy();
    expect(screen.getByText('Interest waived')).toBeTruthy();
    expect(screen.getByText('€1.20')).toBeTruthy();
  });

  it('a loan instalment explains a late fee and opens to its billing', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/credit/loans/ln-1', {
      'GET /v1/me/loans/ln-1': json(LOAN),
      'GET /v1/me/loans/ln-1/schedule': json({
        instalments: [
          {
            sequence: 1,
            dueDate: '2026-11-05',
            amount: '260.84',
            status: 'PARTIALLY_PAID',
            billing: {
              principalBilled: '241.09',
              interestBilled: '19.75',
              feesBilled: '15.00',
              principalPaid: '100.00',
              interestPaid: '19.75',
              feesPaid: '0.00',
              outstanding: '156.09',
            },
          },
          { sequence: 2, dueDate: '2026-12-05', amount: '260.84', status: 'UNBILLED' },
        ],
      }),
    });
    expect(await screen.findByText('Includes a late fee of €15.00')).toBeTruthy();
    expect(screen.getAllByText(/Includes a late fee/)).toHaveLength(1);
    const [first, second] = screen.getAllByRole('button', { name: 'Show details' });
    await user.click(first as HTMLElement);
    expect(screen.getByText('Fees billed')).toBeTruthy();
    expect(screen.getByText('€156.09')).toBeTruthy();
    await user.click(second as HTMLElement);
    expect(screen.getByText('Not billed yet')).toBeTruthy();
  });
});

describe('condition and payout (WP-3 e)', () => {
  it('a default is stated as a fact, and a payout to the bank never says wallet', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-1', {
      'GET /v1/me/loans/ln-1': json({
        ...LOAN,
        status: 'PENDING_DISBURSEMENT',
        payoutStatus: 'DISPATCHED',
        condition: { ...LOAN.condition, defaulted: true, bucket: 'B4' },
      }),
      'GET /v1/me/loans/ln-1/schedule': json({ instalments: [] }),
    });
    expect(await screen.findByText('This account is in default')).toBeTruthy();
    expect(screen.getByText('We are sending the money to your bank account.')).toBeTruthy();
    expect(screen.queryByText(/wallet/)).toBeNull();
    expect(screen.queryByText(/B4/)).toBeNull();
  });

  it('finapp sends payoutStatus null for a wallet loan: no payout words at all (review finding)', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-1', {
      'GET /v1/me/loans/ln-1': json({ ...LOAN, payoutStatus: null }),
      'GET /v1/me/loans/ln-1/schedule': json({ instalments: [] }),
    });
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByText(/bank account/)).toBeNull();
    expect(screen.queryByText(/It is in your wallet/)).toBeNull();
  });

  it('a payout that did not reach the bank says the money is in the wallet', async () => {
    signInForTest();
    renderAppAt('/credit/loans/ln-1', {
      'GET /v1/me/loans/ln-1': json({ ...LOAN, payoutStatus: 'NOT_DISPATCHED' }),
      'GET /v1/me/loans/ln-1/schedule': json({ instalments: [] }),
    });
    expect(await screen.findByText(/It is in your wallet/)).toBeTruthy();
  });
});

describe('pay later (WP-3 a, d, e, g)', () => {
  it('reversed repayments, late fees, interest built up and a default', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/credit/pay-later/ag-1', {
      'GET /v1/me/bnpl-agreements/ag-1': json({
        agreementId: 'ag-1',
        product: 'BNPL_PAY_IN_N',
        plan: 'PAY_IN_6_MONTHS',
        status: 'ACTIVE',
        currency: 'EUR',
        amount: '600.00',
        balances: { principalOutstanding: '500.00', interestAccrued: '3.75' },
        condition: { delinquency: 'PAST_DUE', daysPastDue: 40, defaulted: true },
      }),
      'GET /v1/me/bnpl-agreements/ag-1/schedule': json({
        instalments: [
          {
            sequence: 1,
            dueDate: '2026-10-01',
            amount: '100.00',
            paid: '0.00',
            due: '105.00',
            billed: true,
            billedFees: '5.00',
          },
          { sequence: 2, dueDate: '2026-12-01', amount: '100.00', paid: '0.00', due: '0.00', billed: false },
        ],
      }),
      'GET /v1/me/bnpl-agreements/ag-1/repayments': json({ repayments: [{ ...REVERSED, agreementId: 'ag-1' }] }),
    });
    expect(await screen.findByText('Interest built up')).toBeTruthy();
    expect(screen.getByText('€3.75')).toBeTruthy();
    expect(screen.getByText('This account is in default')).toBeTruthy();
    expect(await screen.findByText('Includes a late fee of €5.00')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Repayments' }));
    expect(await screen.findByText('Reversed - not counted as paid')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Fees')).toBeTruthy();
  });
});

describe('why a check or application closed (WP-3 f)', () => {
  it('a credit check closed for withdrawn consent says so in our words, never finapp’s text', async () => {
    signInForTest();
    renderAppAt('/credit/checks/cr-5', {
      'GET /v1/me/credit/decision-requests/cr-5': json({
        requestId: 'cr-5',
        status: 'CANCELLED',
        closureReason: 'CONSENT_WITHDRAWN',
        statusText: 'Closed: data subject revoked bureau consent',
      }),
    });
    expect(await screen.findByText('You withdrew your consent; give it again to start a new check.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Give your consent again' })).toBeTruthy();
    expect(screen.queryByText(/data subject|bureau/)).toBeNull();
  });

  it('a credit check closed for lost standing reads neutrally', async () => {
    signInForTest();
    renderAppAt('/credit/checks/cr-6', {
      'GET /v1/me/credit/decision-requests/cr-6': json({
        requestId: 'cr-6',
        status: 'CANCELLED',
        closureReason: 'STANDING_LOST',
        statusText: 'Party suspended',
      }),
    });
    expect(await screen.findByText('This check was closed. You can start a new one later.')).toBeTruthy();
    expect(screen.queryByText(/suspended/i)).toBeNull();
  });

  it('a pay-later application closed without a decision says why in our words', async () => {
    signInForTest();
    renderAppAt('/credit/pay-later/applications/ba-2', {
      'GET /v1/me/bnpl-applications/ba-2': json({
        applicationId: 'ba-2',
        status: 'CLOSED_UNDECIDED',
        closureReason: 'SESSION_CLOSED',
      }),
    });
    expect(await screen.findByText('The shop’s checkout closed before we could make you an offer.')).toBeTruthy();
    expect(screen.queryByText('SESSION_CLOSED')).toBeNull();
  });
});
