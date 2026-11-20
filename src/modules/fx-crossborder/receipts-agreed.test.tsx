// @vitest-environment jsdom
// D-R WP-2: the conversion receipt, what was agreed on a payment abroad, and who it went to.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { endSession } from '../../platform/session/session-store.ts';
import { json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';

afterEach(() => {
  endSession('signed-out');
  vi.unstubAllEnvs();
});

const TRADE = (status: string) => ({
  id: 'tr-1',
  quoteId: 'q-1',
  status,
  fixedSide: 'FIXED_SOURCE',
  sourceAmount: '100.00',
  sourceCurrency: 'EUR',
  destinationAmount: '108.23',
  destinationCurrency: 'USD',
  executedRate: '1.08230000',
  // In Los Angeles this instant is still 28 February; the booking date is finapp's and is 1 March.
  bookedAt: '2026-03-01T02:00:00Z',
  bookedOn: '2026-03-01',
});

describe('conversion receipt', () => {
  it('shows both amounts, the executed rate exactly as returned, the booked time with zone and the booking date', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    signInForTest();
    renderAppAt('/exchange/conversions/tr-1', { 'GET /v1/me/fx/conversions/tr-1': json(TRADE('BOOKED')) });
    expect(await screen.findByText('Exchange receipt')).toBeTruthy();
    expect(screen.getByText('€100.00')).toBeTruthy();
    expect(screen.getByText('US$108.23')).toBeTruthy();
    expect(screen.getByText('1 EUR = 1.08230000 USD')).toBeTruthy();
    expect(screen.getByText('Exchanged')).toBeTruthy();
    expect(screen.queryByText(/was reversed/)).toBeNull();
    // The instant is in the customer's zone (28 Feb in Los Angeles), with the zone named ...
    expect(screen.getByText(/28 Feb 2026.*(PST|GMT-8)/)).toBeTruthy();
    // ... and the booking date is not moved by it: through new Date() it would read 28 Feb here.
    expect(screen.getByText('1 Mar 2026')).toBeTruthy();
  });

  it('a reversed exchange carries a caution notice', async () => {
    signInForTest();
    renderAppAt('/exchange/conversions/tr-1', { 'GET /v1/me/fx/conversions/tr-1': json(TRADE('REVERSED')) });
    expect(await screen.findByText('This exchange was reversed. Check your statement.')).toBeTruthy();
    expect(screen.getByText('Reversed')).toBeTruthy();
  });

  it('a status it does not know reads "in progress", never exchanged', async () => {
    signInForTest();
    renderAppAt('/exchange/conversions/tr-1', { 'GET /v1/me/fx/conversions/tr-1': json(TRADE('SETTLING')) });
    expect(await screen.findByText('In progress - check back')).toBeTruthy();
    expect(screen.queryByText('Exchanged')).toBeNull();
  });

  it('is read again on every view', async () => {
    signInForTest();
    const { sent, router } = renderAppAt('/exchange/conversions/tr-1', {
      'GET /v1/me/fx/conversions/tr-1': [json(TRADE('BOOKED')), json(TRADE('REVERSED'))],
      'GET /v1/me/fx/pairs': json({ pairs: [], truncated: false }),
    });
    expect(await screen.findByText('Exchanged')).toBeTruthy();
    await router.navigate({ to: '/exchange' });
    await router.navigate({ to: '/exchange/conversions/$tradeId', params: { tradeId: 'tr-1' } });
    expect(await screen.findByText('This exchange was reversed. Check your statement.')).toBeTruthy();
    expect(sent.filter((s) => s.path === '/v1/me/fx/conversions/tr-1')).toHaveLength(2);
  });

  it.each([404, 400])('a %s reads as one neutral not-found, with no figures', async (status) => {
    signInForTest();
    renderAppAt('/exchange/conversions/nope', {
      'GET /v1/me/fx/conversions/nope': problem(status, status === 404 ? 'api.NotFound' : 'api.BadRequest'),
    });
    expect(await screen.findByText('We could not find this exchange.')).toBeTruthy();
    expect(screen.queryByText(/€|US\$/)).toBeNull();
  });

  it('the exchange result links to the receipt with the trade id from the convert answer', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { router } = renderAppAt('/exchange', {
      'GET /v1/me/fx/pairs': json({
        pairs: [{ sourceCurrency: 'EUR', destinationCurrency: 'USD', available: true }],
        truncated: false,
      }),
      'POST /v1/me/fx/quotes': json(
        {
          id: 'q-1',
          status: 'ISSUED',
          sourceCurrency: 'EUR',
          destinationCurrency: 'USD',
          sourceAmount: '100.00',
          destinationAmount: '108.23',
          customerRate: '1.0823',
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        },
        201,
      ),
      'POST /v1/me/fx/conversions': json(TRADE('BOOKED'), 201),
      'GET /v1/me/fx/conversions/tr-1': json(TRADE('BOOKED')),
    });
    for (const [label, option] of [
      ['From', 'EUR'],
      ['To', 'USD'],
    ] as const) {
      const input = (await screen.findAllByLabelText(label)).find((el) => el.tagName === 'INPUT');
      if (input === undefined) throw new Error(`no select ${label}`);
      await user.click(input);
      await user.click(await screen.findByRole('option', { name: option }));
    }
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(screen.getByRole('button', { name: 'Get a quote' }));
    await user.click(await screen.findByRole('button', { name: 'Exchange now' }));
    await user.click(await screen.findByRole('link', { name: 'View receipt' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/exchange/conversions/tr-1'));
    expect(await screen.findByText('Exchange receipt')).toBeTruthy();
  });
});

describe('a payment abroad: what was agreed and who it went to', () => {
  const OFFER = {
    id: 'xq-1',
    beneficiaryId: 'xb-1',
    // The OFFER's status - it must never be shown as the payment's.
    status: 'DELIVERED',
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
    expiresAt: '2026-03-01T02:00:00Z',
  };
  const PAYMENT = (status: string, extra: Record<string, unknown> = {}) => ({
    paymentId: 'xp-1',
    quoteId: 'xq-1',
    beneficiaryId: 'xb-1',
    status,
    cancellationRequested: false,
    ...extra,
  });
  const RECIPIENT = (status: string) => ({
    id: 'xb-1',
    nickname: 'Mum <b>',
    suffix: '7788',
    country: 'US',
    currency: 'USD',
    entityType: 'INDIVIDUAL',
    status,
  });

  it('shows the agreed figures as finapp sent them, and the status from the payment read only', async () => {
    signInForTest();
    renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': json(PAYMENT('PROCESSING')),
      'GET /v1/me/cross-border/quotes/xq-1': json(OFFER),
      'GET /v1/me/cross-border/beneficiaries/xb-1': json(RECIPIENT('ACTIVE')),
    });
    const card = (await screen.findByText('What you agreed')).closest('.mantine-Card-root');
    if (!(card instanceof HTMLElement)) throw new Error('no agreed card');
    const agreed = within(card);
    expect(agreed.getByText('€200.00')).toBeTruthy();
    expect(agreed.getByText('€3.00')).toBeTruthy();
    expect(agreed.getByText('€203.00')).toBeTruthy();
    expect(agreed.getByText('US$215.10')).toBeTruthy();
    expect(agreed.getByText('They were to receive (guaranteed)')).toBeTruthy();
    expect(agreed.getByText('1 EUR = 1.0755 USD')).toBeTruthy();
    expect(agreed.getByText(/margin of 0.30% over the mid-market rate/)).toBeTruthy();
    expect(agreed.getByText(/Usually arrives within 2 days/)).toBeTruthy();
    // The payment is processing; the offer's DELIVERED is never shown.
    expect(screen.getByText('Processing')).toBeTruthy();
    expect(screen.queryByText('Delivered')).toBeNull();
    expect(screen.queryByText('The recipient’s bank has the money.')).toBeNull();
  });

  it('if the offer cannot be read, shows no figures - the status card alone', async () => {
    signInForTest();
    const { sent } = renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': json(PAYMENT('SENT')),
      'GET /v1/me/cross-border/quotes/xq-1': problem(503, 'crossborder.ProviderUnavailable'),
      'GET /v1/me/cross-border/beneficiaries/xb-1': json(RECIPIENT('ACTIVE')),
    });
    expect(await screen.findByText(/on its way/)).toBeTruthy();
    await waitFor(() => expect(sent.some((s) => s.path === '/v1/me/cross-border/quotes/xq-1')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('What you agreed')).toBeNull();
    expect(screen.queryByText(/€|US\$/)).toBeNull();
    // Read once: a failure is not retried.
    expect(sent.filter((s) => s.path === '/v1/me/cross-border/quotes/xq-1')).toHaveLength(1);
  });

  it('an offer answered for another quote shows no figures', async () => {
    signInForTest();
    renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': json(PAYMENT('SENT')),
      'GET /v1/me/cross-border/quotes/xq-1': json({ ...OFFER, id: 'xq-other' }),
    });
    expect(await screen.findByText(/on its way/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('What you agreed')).toBeNull();
    expect(screen.queryByText('€203.00')).toBeNull();
  });

  it('the offer is read once - a cancellation re-reads the payment, not the offer', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': [
        json(PAYMENT('PROCESSING')),
        json(PAYMENT('PROCESSING', { cancellationRequested: true })),
      ],
      'GET /v1/me/cross-border/quotes/xq-1': json(OFFER),
      'GET /v1/me/cross-border/beneficiaries/xb-1': json(RECIPIENT('ACTIVE')),
      'POST /v1/me/cross-border/payments/xp-1/cancellation': json(
        PAYMENT('PROCESSING', { cancellationRequested: true }),
        202,
      ),
    });
    expect(await screen.findByText('What you agreed')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel this payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this payment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel this payment' }));
    expect(await screen.findByText(/You asked to cancel/)).toBeTruthy();
    await waitFor(() =>
      expect(sent.filter((s) => s.path === '/v1/me/cross-border/payments/xp-1').length).toBeGreaterThanOrEqual(2),
    );
    expect(sent.filter((s) => s.path === '/v1/me/cross-border/quotes/xq-1')).toHaveLength(1);
  });

  it('a returned payment says it came back less any fee and points to the statement', async () => {
    signInForTest();
    renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': json(PAYMENT('RETURNED')),
      'GET /v1/me/cross-border/quotes/xq-1': json(OFFER),
    });
    expect(
      await screen.findByText('The money came back to your wallet, less any fee. See your statement.'),
    ).toBeTruthy();
    expect(screen.queryByText(/money is returned to your wallet/)).toBeNull();
  });

  it('names the recipient as plain text, even once removed, with status words only', async () => {
    signInForTest();
    const { view } = renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': json(PAYMENT('DELIVERED')),
      'GET /v1/me/cross-border/beneficiaries/xb-1': json(RECIPIENT('REVOKED')),
    });
    expect(await screen.findByText('To Mum <b>, account ending 7788, United States')).toBeTruthy();
    expect(screen.getByText('Removed')).toBeTruthy();
    expect(view.container.querySelector('b')).toBeNull();
  });

  it('an unavailable recipient says so - never why', async () => {
    signInForTest();
    renderAppAt('/send-abroad/payments/xp-1', {
      'GET /v1/me/cross-border/payments/xp-1': json(PAYMENT('SENT')),
      'GET /v1/me/cross-border/beneficiaries/xb-1': json({ ...RECIPIENT('UNAVAILABLE'), reason: 'SANCTIONS_HIT' }),
    });
    expect(await screen.findByText('Not available')).toBeTruthy();
    expect(screen.queryByText(/SANCTIONS|block|screen|risk/i)).toBeNull();
  });
});
