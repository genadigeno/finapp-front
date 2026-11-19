// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { endSession } from '../../platform/session/session-store.ts';
import { json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';
import { deliveryEstimate, fractionToPercent } from './labels.ts';

afterEach(() => endSession('signed-out'));

const PAIRS = json({
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
    { sourceCurrency: 'EUR', destinationCurrency: 'JPY', available: false },
  ],
  truncated: false,
});
const later = () => new Date(Date.now() + 10 * 60_000).toISOString();

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: RegExp | string) {
  const input = (await screen.findAllByLabelText(label)).find((el) => el.tagName === 'INPUT');
  if (input === undefined) throw new Error(`no select ${label}`);
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('figures by string arithmetic', () => {
  it.each([
    ['0.004500', '0.45'],
    ['0.0125', '1.25'],
    ['0.000001', '0.0001'],
    ['0', '0.00'],
  ])('%s is %s%%', (fraction, percent) => {
    expect(fractionToPercent(fraction)).toBe(percent);
  });

  it('delivery estimates in days or hours', () => {
    expect(deliveryEstimate(36)).toEqual({ days: 2 });
    expect(deliveryEstimate(6)).toEqual({ hours: 6 });
    expect(deliveryEstimate(undefined)).toBeUndefined();
  });
});

describe('exchange (P18-TSK-025; blueprint §17 scenario 9)', () => {
  const QUOTE = (expiresAt: string) => ({
    id: 'q-1',
    status: 'ISSUED',
    sourceCurrency: 'EUR',
    destinationCurrency: 'USD',
    fixedSide: 'FIXED_SOURCE',
    sourceAmount: '100.00',
    destinationAmount: '108.23',
    customerRate: '1.0823',
    disclosedMarginOverMid: '0.004500',
    expiresAt,
  });

  async function quote(user: ReturnType<typeof userEvent.setup>) {
    await pick(user, 'From', 'EUR');
    await pick(user, 'To', 'USD');
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(screen.getByRole('button', { name: 'Get a quote' }));
  }

  it('offers only available pairs, quotes under a key, shows rate and margin, and converts once', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/exchange', {
      'GET /v1/me/fx/pairs': PAIRS,
      'POST /v1/me/fx/quotes': json(QUOTE(later()), 201),
      'POST /v1/me/fx/conversions': json(
        { id: 'tr-1', status: 'BOOKED', destinationAmount: '108.23', destinationCurrency: 'USD' },
        201,
      ),
    });
    await pick(user, 'From', 'EUR');
    const to = (await screen.findAllByLabelText('To')).find((el) => el.tagName === 'INPUT');
    if (to === undefined) throw new Error('no to');
    await user.click(to);
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['USD']);
    await user.click(screen.getByRole('option', { name: 'USD' }));
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(screen.getByRole('button', { name: 'Get a quote' }));
    expect(await screen.findByText('1 EUR = 1.0823 USD')).toBeTruthy();
    expect(screen.getByText(/margin of 0.45% over the mid-market rate/)).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toMatch(/Expires in/);
    await user.click(screen.getByRole('button', { name: 'Exchange now' }));
    expect(await screen.findByText('Exchanged')).toBeTruthy();
    expect(sent.find((s) => s.path === '/v1/me/fx/quotes')?.body).toEqual({
      sourceCurrency: 'EUR',
      destinationCurrency: 'USD',
      fixedSide: 'FIXED_SOURCE',
      amount: '100',
    });
    const conversions = sent.filter((s) => s.path === '/v1/me/fx/conversions');
    expect(conversions).toHaveLength(1);
    expect(conversions[0]?.body).toEqual({ quoteId: 'q-1' });
    expect(conversions[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('an expired quote cannot be confirmed; a new one can be asked for', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/exchange', {
      'GET /v1/me/fx/pairs': PAIRS,
      'POST /v1/me/fx/quotes': json(QUOTE(new Date(Date.now() - 1_000).toISOString()), 201),
    });
    await quote(user);
    expect(await screen.findByText(/This quote has expired/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Exchange now' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Get a new quote' }));
    expect(await screen.findByRole('button', { name: 'Get a quote' })).toBeTruthy();
  });

  it('finapp refusing for an expired quote leads to re-quoting, never auto-acceptance', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/exchange', {
      'GET /v1/me/fx/pairs': PAIRS,
      'POST /v1/me/fx/quotes': json(QUOTE(later()), 201),
      'POST /v1/me/fx/conversions': problem(409, 'fx.QuoteExpired'),
    });
    await quote(user);
    await user.click(await screen.findByRole('button', { name: 'Exchange now' }));
    expect(await screen.findByText('Your quote has expired')).toBeTruthy();
    expect(sent.filter((s) => s.path === '/v1/me/fx/conversions')).toHaveLength(1);
  });
});

describe('send abroad (P18-TSK-026)', () => {
  const RECIPIENTS = json({
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
      { id: 'xb-2', nickname: 'Shop', country: 'US', currency: 'USD', entityType: 'BUSINESS', status: 'UNAVAILABLE' },
    ],
    truncated: false,
  });
  const CORRIDORS = json({
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
  });

  it('lists recipients with their state - never why one is unavailable - and only the ready one can be paid', async () => {
    signInForTest();
    renderAppAt('/send-abroad', {
      'GET /v1/me/cross-border/beneficiaries': RECIPIENTS,
      'GET /v1/me/cross-border/corridors': CORRIDORS,
    });
    expect(await screen.findByText('Mum')).toBeTruthy();
    expect(screen.getByText('Ready to pay')).toBeTruthy();
    expect(screen.getByText('Not available')).toBeTruthy();
    expect(screen.queryByText(/block|screen|risk/i)).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Send' })).toHaveLength(1);
    expect(screen.getByText(/Usually arrives within 2 days/)).toBeTruthy();
    expect(screen.getByText(/Adding an overseas recipient is not available here yet/)).toBeTruthy();
  });

  it('quotes with the fee and total shown first, pays under a key, and follows the payment', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/send-abroad/send', {
      'GET /v1/me/cross-border/beneficiaries': RECIPIENTS,
      'GET /v1/me/cross-border/corridors': CORRIDORS,
      'POST /v1/me/cross-border/quotes': json(
        {
          id: 'xq-1',
          beneficiaryId: 'xb-1',
          status: 'ISSUED',
          fixedSide: 'FIXED_SOURCE',
          sourceCurrency: 'EUR',
          destinationCurrency: 'USD',
          sourceAmount: '200.00',
          fee: '3.00',
          totalDebit: '203.00',
          destinationAmount: '215.10',
          customerRate: '1.0755',
          disclosedMarginOverMid: '0.003000',
          deliveryEstimateHours: 48,
          expiresAt: later(),
        },
        201,
      ),
      'POST /v1/me/cross-border/payments': json({ paymentId: 'xp-1', status: 'PROCESSING', quoteId: 'xq-1' }, 202),
      'GET /v1/me/cross-border/payments/xp-1': json({
        paymentId: 'xp-1',
        status: 'PROCESSING',
        cancellationRequested: false,
      }),
    });
    await pick(user, 'Recipient', /Mum/);
    await pick(user, 'Pay from your', 'EUR');
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.click(screen.getByRole('button', { name: 'Get a quote' }));
    expect(await screen.findByText('€3.00')).toBeTruthy();
    expect(screen.getByText('€203.00')).toBeTruthy();
    expect(screen.getByText('US$215.10')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Send payment' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/send-abroad/payments/xp-1'));
    expect(await screen.findByText(/We are sending your payment/)).toBeTruthy();
    const payment = sent.find((s) => s.path === '/v1/me/cross-border/payments');
    expect(payment?.body).toEqual({ quoteId: 'xq-1' });
    expect(payment?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a payment still being processed can be asked to cancel, after confirmation', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': [
        json({ paymentId: 'xp-1', status: 'PROCESSING', cancellationRequested: false }),
        json({ paymentId: 'xp-1', status: 'PROCESSING', cancellationRequested: true }),
      ],
      'POST /v1/me/cross-border/payments/xp-1/cancellation': json(
        { paymentId: 'xp-1', status: 'PROCESSING', cancellationRequested: true },
        202,
      ),
    });
    await user.click(await screen.findByRole('button', { name: 'Cancel this payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this payment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel this payment' }));
    expect(await screen.findByText(/You asked to cancel/)).toBeTruthy();
    expect(sent.find((s) => s.path.endsWith('/cancellation'))?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});
