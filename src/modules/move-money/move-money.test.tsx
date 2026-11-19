// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { endSession } from '../../platform/session/session-store.ts';
import {
  empty,
  ISSUED,
  json,
  problem,
  renderAppAt,
  signInForTest,
  type Script,
} from '../../testing/scripted-finapp.tsx';
import { safeAuthorizationUrl } from './labels.ts';
import { failureWords } from './SendPage.tsx';

afterEach(() => endSession('signed-out'));

const ACC = '0190a3c1-acc0-7222-8333-444455556666';
const WALLET: Script = {
  'GET /v1/me/accounts': json([{ id: ACC, productType: 'WALLET', status: 'ACTIVE' }]),
  [`GET /v1/me/accounts/${ACC}/balances`]: json({
    kind: 'PROJECTION',
    balances: [{ currency: 'EUR', settled: '500.00', holds: '0.00', available: '500.00' }],
  }),
};
const RECIPIENT = {
  id: 'b-1',
  displayName: 'Grace',
  destinationAccountId: '0190a3c1-dddd-7222-8333-444455556666',
  createdAt: '2026-11-18T10:00:00Z',
};

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: RegExp | string) {
  const input = (await screen.findAllByLabelText(label)).find((el) => el.tagName === 'INPUT');
  if (input === undefined) throw new Error(`no select ${label}`);
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('recipients (P18-TSK-021)', () => {
  it('adds a recipient by account reference and removes one after confirmation', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/move/recipients', {
      'GET /v1/beneficiaries': [json([]), json([RECIPIENT]), json([])],
      'POST /v1/beneficiaries': json(RECIPIENT, 201),
      'DELETE /v1/beneficiaries/b-1': empty(),
    });
    await user.type(await screen.findByLabelText('Name for this recipient'), 'Grace');
    await user.type(screen.getByLabelText('Their account reference'), RECIPIENT.destinationAccountId.toUpperCase());
    await user.click(screen.getByRole('button', { name: 'Add recipient' }));
    expect(await screen.findByText('Grace')).toBeTruthy();
    expect(sent.find((s) => s.method === 'POST')?.body).toEqual({
      displayName: 'Grace',
      destinationAccountId: RECIPIENT.destinationAccountId,
    });
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this recipient?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('Grace')).toBeNull());
  });
});

describe('sending money (P18-TSK-022; ADR-F05)', () => {
  async function fillAndReview(user: ReturnType<typeof userEvent.setup>) {
    await pick(user, 'From', /^EUR/);
    await pick(user, 'To', 'Grace');
    await user.type(screen.getByLabelText('Amount'), '25.50');
    await user.type(screen.getByLabelText('Reference (optional)'), 'Dinner');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Check before you send' });
  }

  it('reviews, sends once under one key, and shows the receipt', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/move/send', {
      ...WALLET,
      'GET /v1/beneficiaries': json([RECIPIENT]),
      'POST /v1/transfers': json({ id: 't-1', status: 'COMPLETED', amount: '25.50', currency: 'EUR' }, 201),
    });
    await fillAndReview(user);
    expect(screen.getByText('€25.50')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Send now' });
    await user.dblClick(confirm);
    expect(await screen.findByText('Money sent')).toBeTruthy();
    const transfers = sent.filter((s) => s.path === '/v1/transfers');
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.body).toEqual({
      sourceAccountId: ACC,
      beneficiaryId: 'b-1',
      amount: '25.50',
      currency: 'EUR',
      reference: 'Dinner',
    });
    expect(transfers[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('steps up when risk asks, then sends the same request with the same key', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/move/send', {
      ...WALLET,
      'GET /v1/beneficiaries': json([RECIPIENT]),
      'POST /v1/transfers': [
        problem(403, 'identity.AssuranceRequired'),
        json({ id: 't-1', status: 'COMPLETED', amount: '25.50', currency: 'EUR' }, 201),
      ],
      'POST /v1/authentications/mfa': json(ISSUED('MULTI_FACTOR', 'tok-up')),
    });
    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: 'Send now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await user.type(within(dialog).getByLabelText('Authentication code'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Money sent')).toBeTruthy();
    const transfers = sent.filter((s) => s.path === '/v1/transfers');
    expect(transfers).toHaveLength(2);
    expect(transfers[0]?.headers.get('Idempotency-Key')).toBe(transfers[1]?.headers.get('Idempotency-Key'));
    expect(transfers[1]?.body).toEqual(transfers[0]?.body);
    expect(transfers[1]?.headers.get('Authorization')).toBe('Bearer tok-up');
  });

  it('a failed transfer says what the customer can act on; a risk refusal says nothing more', async () => {
    expect(failureWords('INSUFFICIENT_FUNDS').defaultMessage).toMatch(/not enough money/);
    expect(failureWords('RISK_REFUSED').defaultMessage).toBe(
      'This transfer could not be completed. Nothing was taken from your wallet.',
    );
    expect(failureWords('LIMIT_REFUSED')).toBe(failureWords('RISK_REFUSED'));
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/move/send', {
      ...WALLET,
      'GET /v1/beneficiaries': json([RECIPIENT]),
      'POST /v1/transfers': json({ id: 't-1', status: 'FAILED', failureReason: 'RISK_REFUSED' }, 201),
    });
    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText('The money was not sent')).toBeTruthy();
    expect(screen.queryByText(/risk|limit|refused/i)).toBeNull();
  });

  it('a lost answer is never a failure: the same request goes again under the same key (scenario 5)', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/move/send', {
      ...WALLET,
      'GET /v1/beneficiaries': json([RECIPIENT]),
      'POST /v1/transfers': [
        problem(500, 'api.InternalError'),
        json({ id: 't-1', status: 'COMPLETED', amount: '25.50', currency: 'EUR' }, 201),
      ],
    });
    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: 'Send now' }));
    await user.click(await screen.findByRole('button', { name: 'Send the same request again' }));
    expect(await screen.findByText('Money sent')).toBeTruthy();
    const keys = sent.filter((s) => s.path === '/v1/transfers').map((s) => s.headers.get('Idempotency-Key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('top-up (P18-TSK-023)', () => {
  const CARD = {
    id: 'pm-card',
    kind: 'CARD_TOKEN',
    brand: 'Visa',
    displaySuffix: '4242',
    expiryMonth: 4,
    expiryYear: 2029,
  };
  const BANK = { id: 'pm-bank', kind: 'BANK_ACCOUNT', displaySuffix: '0012', payeeCheck: 'MATCH' };

  async function fill(user: ReturnType<typeof userEvent.setup>, method: RegExp) {
    await pick(user, 'Pay with', method);
    await pick(user, 'Add to', /^EUR/);
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Pay now' }));
  }

  it('a card pays at once: opens the payment under a key, confirms it, shows the money added', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/move/top-up', {
      ...WALLET,
      'GET /v1/me/payment-methods': json([CARD]),
      'POST /v1/payments': json({ id: 'pi-1', status: 'REQUIRES_CONFIRMATION' }, 201),
      'POST /v1/payments/pi-1/confirmation': json({
        id: 'pi-1',
        status: 'SUCCEEDED',
        amount: '100.00',
        currency: 'EUR',
      }),
    });
    await fill(user, /Visa/);
    expect(await screen.findByText('Money added')).toBeTruthy();
    const open = sent.find((s) => s.path === '/v1/payments');
    expect(open?.body).toEqual({ paymentMethodId: 'pm-card', amount: '100', currency: 'EUR' });
    expect(open?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a bank payment goes to its status page with the approval link, and follows it', async () => {
    const user = userEvent.setup();
    signInForTest();
    const processing = {
      id: 'pi-2',
      status: 'PROCESSING',
      amount: '100.00',
      currency: 'EUR',
      authorizationHandle: 'https://bank.example/approve/abc',
    };
    const { router } = renderAppAt('/move/top-up', {
      ...WALLET,
      'GET /v1/me/payment-methods': json([BANK]),
      'POST /v1/payments': json({ id: 'pi-2', status: 'REQUIRES_CONFIRMATION' }, 201),
      'POST /v1/payments/pi-2/confirmation': json(processing),
      'GET /v1/payments/pi-2': json(processing),
    });
    await fill(user, /0012/);
    await waitFor(() => expect(router.state.location.pathname).toBe('/move/top-ups/pi-2'));
    const link = await screen.findByRole('link', { name: 'Approve the payment at your bank' });
    expect(link.getAttribute('href')).toBe('https://bank.example/approve/abc');
  });

  it('only an https approval link is ever followed', () => {
    expect(safeAuthorizationUrl('https://bank.example/x')).toBe('https://bank.example/x');
    expect(safeAuthorizationUrl(['javascript', 'alert(1)'].join(':'))).toBeUndefined();
    expect(safeAuthorizationUrl('http://bank.example/x')).toBeUndefined();
    expect(safeAuthorizationUrl('not a url')).toBeUndefined();
  });

  it('with nothing to pay with, says so and points to payment methods', async () => {
    signInForTest();
    renderAppAt('/move/top-up', { ...WALLET, 'GET /v1/me/payment-methods': json([]) });
    expect(await screen.findByText('You have no card or bank account to pay with.')).toBeTruthy();
  });
});

describe('withdrawals (P18-TSK-024)', () => {
  it('offers only bank accounts, dispatches under a key, and follows the withdrawal; a hold reads as processing', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/move/withdraw', {
      ...WALLET,
      'GET /v1/me/payment-methods': json([
        { id: 'pm-card', kind: 'CARD_TOKEN', brand: 'Visa', displaySuffix: '4242' },
        { id: 'pm-bank', kind: 'BANK_ACCOUNT', displaySuffix: '0012' },
      ]),
      'POST /v1/me/withdrawals': json({ id: 'w-1', status: 'HELD', amount: '50.00', currency: 'EUR' }, 201),
      'GET /v1/me/withdrawals/w-1': json({ id: 'w-1', status: 'HELD', amount: '50.00', currency: 'EUR' }),
    });
    await pick(user, 'From', /^EUR/);
    const toInput = (await screen.findAllByLabelText('To your bank account')).find((el) => el.tagName === 'INPUT');
    if (toInput === undefined) throw new Error('no bank select');
    await user.click(toInput);
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options.some((o) => o?.includes('4242'))).toBe(false);
    await user.click(screen.getByRole('option', { name: /0012/ }));
    await user.type(screen.getByLabelText('Amount'), '50');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Withdraw now' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/move/withdrawals/w-1'));
    expect(await screen.findByText('Processing')).toBeTruthy();
    expect(screen.queryByText(/hold|review/i)).toBeNull();
    expect(sent.find((s) => s.path === '/v1/me/withdrawals')?.body).toEqual({
      paymentMethodId: 'pm-bank',
      amount: '50',
      currency: 'EUR',
    });
  });
});

describe('payment methods (P18-TSK-023)', () => {
  it('lists what finapp holds, says adding is not available, and removes after confirmation', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/move/payment-methods', {
      'GET /v1/me/payment-methods': [
        json([{ id: 'pm-bank', kind: 'BANK_ACCOUNT', displaySuffix: '0012', payeeCheck: 'CLOSE_MATCH' }]),
        json([]),
      ],
      'DELETE /v1/me/payment-methods/pm-bank': empty(),
    });
    expect(await screen.findByText(/ending 0012/)).toBeTruthy();
    expect(screen.getByText('The name on the account is close to yours')).toBeTruthy();
    expect(screen.getByText(/Adding a card or linking a bank account is not available here yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this payment method?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await screen.findByText('No cards or bank accounts yet');
    expect(sent.some((s) => s.method === 'DELETE')).toBe(true);
  });
});
