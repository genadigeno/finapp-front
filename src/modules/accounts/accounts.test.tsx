// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { endSession } from '../../platform/session/session-store.ts';
import { json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';
import { currencyOptions } from './currencies.ts';
import { directionOf, lineName } from './labels.ts';

afterEach(() => endSession('signed-out'));

const ACC = '0190a3c1-acc0-7222-8333-444455556666';
const ACCOUNT = { id: ACC, productType: 'WALLET', status: 'ACTIVE', openedAt: '2026-11-01T09:00:00Z' };
const BALANCES = json({
  accountId: ACC,
  kind: 'PROJECTION',
  balances: [
    { currency: 'EUR', settled: '1250.00', holds: '70.00', available: '1180.00' },
    { currency: 'JPY', settled: '98000', holds: '0', available: '98000' },
  ],
});
const ONBOARDING = {
  'GET /v1/me': json({ partyId: 'p-1', kind: 'PERSON', displayName: 'Ada' }),
  'GET /v1/me/kyc': json({ status: 'APPROVED' }),
  'GET /v1/me/kyb': problem(404, 'api.NotFound'),
  'GET /v1/me/consents': json([]),
};

describe('accounts and balances (P18-TSK-017, -018; ADR-F04)', () => {
  it('lists each account with its available balance per currency, never summed', async () => {
    signInForTest();
    renderAppAt('/accounts', {
      'GET /v1/me/accounts': json([ACCOUNT]),
      [`GET /v1/me/accounts/${ACC}/balances`]: BALANCES,
    });
    expect(await screen.findByText('€1,180.00')).toBeTruthy();
    expect(screen.getByText('JP¥98,000')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    // One live wallet per customer: no second "open" is offered.
    expect(screen.queryByRole('link', { name: 'Open an account' })).toBeNull();
  });

  it('offers to open an account when none is live, and opens one under an idempotency key', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/accounts', {
      'GET /v1/me/accounts': [json([{ ...ACCOUNT, status: 'CLOSED' }]), json([ACCOUNT])],
      [`GET /v1/me/accounts/${ACC}/balances`]: BALANCES,
      'POST /v1/me/accounts': json(ACCOUNT, 201),
    });
    await user.click(await screen.findByRole('link', { name: 'Open an account' }));
    const select = (await screen.findAllByLabelText('Currency')).find((el) => el.tagName === 'INPUT');
    if (select === undefined) throw new Error('no currency select');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: /^EUR/ }));
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/accounts/${ACC}`));
    const open = sent.find((s) => s.method === 'POST' && s.path === '/v1/me/accounts');
    expect(open?.body).toEqual({ productType: 'WALLET', currency: 'EUR' });
    expect(open?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('explains a refusal to open before identity is verified', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/accounts/open', { 'POST /v1/me/accounts': problem(409, 'accounts.AccountOpeningRefused') });
    const select = (await screen.findAllByLabelText('Currency')).find((el) => el.tagName === 'INPUT');
    if (select === undefined) throw new Error('no currency select');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: /^GBP/ }));
    await user.click(screen.getByRole('button', { name: 'Open wallet' }));
    expect(await screen.findByText('You cannot open an account yet')).toBeTruthy();
  });

  it('shows each currency’s balance labelled, and offers only currencies not yet held', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt(`/accounts/${ACC}`, {
      'GET /v1/me/accounts': json([ACCOUNT]),
      [`GET /v1/me/accounts/${ACC}/balances`]: BALANCES,
      [`POST /v1/me/accounts/${ACC}/currencies`]: json({ accountId: ACC, currency: 'USD' }, 201),
    });
    expect(await screen.findByText('€1,180.00')).toBeTruthy();
    expect(screen.getByText('€1,250.00')).toBeTruthy();
    expect(screen.getByText('€70.00')).toBeTruthy();
    expect(screen.getAllByText(/Balance as of/)).toHaveLength(2);
    const select = screen.getAllByLabelText('Currency').find((el) => el.tagName === 'INPUT');
    if (select === undefined) throw new Error('no currency select');
    await user.click(select);
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent?.slice(0, 3));
    expect(options).toEqual(['GBP', 'USD', 'BHD']);
    await user.click(screen.getByRole('option', { name: /^USD/ }));
    await user.click(screen.getByRole('button', { name: 'Add currency' }));
    expect(await screen.findByText('Added. Its balance appears above.')).toBeTruthy();
    const add = sent.find((s) => s.path.endsWith('/currencies'));
    expect(add?.body).toEqual({ currency: 'USD' });
    expect(add?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('closes only after confirmation, and explains finapp refusing a non-empty account', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt(`/accounts/${ACC}`, {
      'GET /v1/me/accounts': json([ACCOUNT]),
      [`GET /v1/me/accounts/${ACC}/balances`]: BALANCES,
      [`DELETE /v1/me/accounts/${ACC}`]: problem(409, 'accounts.AccountNotEmpty'),
    });
    await user.click(await screen.findByRole('button', { name: 'Close this account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Close this account?' });
    await user.click(within(dialog).getByRole('button', { name: 'Close this account' }));
    expect(await screen.findByText('This account cannot be closed yet')).toBeTruthy();
  });

  it('an account that is not the customer’s is simply not found (scenario 4)', async () => {
    signInForTest();
    renderAppAt('/accounts/0190a3c1-0000-7222-8333-444455556666', {
      'GET /v1/me/accounts': json([ACCOUNT]),
      'GET /v1/me/accounts/0190a3c1-0000-7222-8333-444455556666/balances': problem(404, 'api.NotFound'),
    });
    expect(await screen.findByText('We could not find this account.')).toBeTruthy();
  });

  it('the dashboard shows the customer’s money once they hold an account', async () => {
    signInForTest();
    renderAppAt('/home', {
      ...ONBOARDING,
      'GET /v1/me/accounts': json([ACCOUNT]),
      [`GET /v1/me/accounts/${ACC}/balances`]: BALANCES,
    });
    expect(await screen.findByRole('heading', { name: 'Your money' })).toBeTruthy();
    expect(await screen.findByText('€1,180.00')).toBeTruthy();
    expect(screen.getByText(/Available, as of/)).toBeTruthy();
  });
});

describe('statements (P18-TSK-019)', () => {
  it('asks finapp for the period and shows its opening, lines and closing as given', async () => {
    signInForTest();
    const { sent } = renderAppAt(`/accounts/${ACC}/statement`, {
      [`GET /v1/me/accounts/${ACC}/statement`]: json({
        accountId: ACC,
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
      }),
    });
    expect(await screen.findByText('+€50.00')).toBeTruthy();
    expect(screen.getByText('-€20.00')).toBeTruthy();
    expect(screen.getByText('Reversal')).toBeTruthy();
    expect(screen.getByText(/Opening balance/).textContent).toContain('€100.00');
    expect(screen.getByText(/Closing balance/).textContent).toContain('€130.00');
    expect(screen.getAllByText('Money in:', { exact: false }).length).toBeGreaterThan(0);
    const request = sent.find((s) => s.path.endsWith('/statement'));
    expect(request).toBeTruthy();
  });

  it('refuses a period that ends before it starts, without asking finapp', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt(`/accounts/${ACC}/statement`, {
      [`GET /v1/me/accounts/${ACC}/statement`]: json({ sections: [] }),
    });
    await screen.findByText('This account held no money in this period.');
    const before = sent.length;
    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-11-30');
    const to = screen.getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Show statement' }));
    expect(await screen.findByText('The start date must be on or before the end date.')).toBeTruthy();
    expect(sent.length).toBe(before);
  });

  it('direction and line names', () => {
    expect(directionOf('CREDIT')).toBe('in');
    expect(directionOf('DEBIT')).toBe('out');
    expect(directionOf('OTHER')).toBeUndefined();
    expect(lineName('ADJUSTMENT', 'Account adjustment')).toBe('Account adjustment');
    expect(lineName('POSTING', undefined)).toMatchObject({ defaultMessage: 'Transaction' });
  });

  it('currencies are finapp’s five, minus those held', () => {
    expect(currencyOptions('en', ['EUR']).map((o) => o.value)).toEqual(['GBP', 'USD', 'JPY', 'BHD']);
  });
});

describe('activity (P18-TSK-020)', () => {
  it('lists transfers sent and top-ups in finapp’s order, and says received money is on the statement', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/activity', {
      'GET /v1/transfers': json([
        {
          id: 't-2',
          amount: '20.00',
          currency: 'EUR',
          status: 'COMPLETED',
          reference: 'Rent',
          createdAt: '2026-11-18T10:00:00Z',
        },
        {
          id: 't-1',
          amount: '5.00',
          currency: 'EUR',
          status: 'FAILED',
          failureReason: 'RISK_REFUSED',
          createdAt: '2026-11-17T10:00:00Z',
        },
      ]),
      'GET /v1/payments': json([
        { id: 'pi-1', amount: '100.00', currency: 'EUR', status: 'SUCCEEDED', createdAt: '2026-11-16T10:00:00Z' },
      ]),
    });
    expect(await screen.findByText('€20.00')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Not completed')).toBeTruthy();
    // No refusal reason is shown (INV-RSK-08).
    expect(screen.queryByText(/RISK|refused/i)).toBeNull();
    expect(screen.getByText(/Money you received is not listed here/)).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Top-ups and purchases' }));
    expect(await screen.findByText('€100.00')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
  });

  it('an empty history says so', async () => {
    signInForTest();
    renderAppAt('/activity', { 'GET /v1/transfers': json([]), 'GET /v1/payments': json([]) });
    expect(await screen.findByText('You have not sent any transfers')).toBeTruthy();
  });

  it('a module that is unavailable is said to be, and the rest works (scenario 10)', async () => {
    signInForTest();
    renderAppAt('/activity', {
      'GET /v1/transfers': problem(503, 'api.Overloaded'),
      'GET /v1/payments': json([]),
    });
    expect(await screen.findByText('This is temporarily unavailable', {}, { timeout: 15_000 })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });
});
