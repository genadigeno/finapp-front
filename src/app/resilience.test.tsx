// @vitest-environment jsdom
// What the customer sees when the connection goes (blueprint §16 "Offline"; docs/RUNBOOK.md): the shell says so,
// command screens send nothing, and both recover by themselves when the connection returns. Nothing is queued.
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { endSession } from '../platform/session/session-store.ts';
import { json, renderAppAt, signInForTest } from '../testing/scripted-finapp.tsx';

afterEach(() => {
  vi.restoreAllMocks();
  endSession('signed-out');
});

function goOffline(offline: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!offline);
  act(() => {
    window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
  });
}

describe('offline (blueprint §16)', () => {
  it('says so, disables commands, sends nothing, and recovers when the connection returns', async () => {
    signInForTest();
    const { sent } = renderAppAt('/exchange', {
      'GET /v1/me/fx/pairs': json({
        pairs: [{ sourceCurrency: 'EUR', destinationCurrency: 'USD', available: true }],
        truncated: false,
      }),
    });
    const quote = (await screen.findByRole('button', { name: 'Get a quote' })) as HTMLButtonElement;
    expect(quote.disabled).toBe(false);
    goOffline(true);
    expect(await screen.findByText('You are offline')).toBeTruthy();
    await waitFor(() => expect(quote.disabled).toBe(true));
    goOffline(false);
    await waitFor(() => expect(screen.queryByText('You are offline')).toBeNull());
    expect(quote.disabled).toBe(false);
    expect(sent.filter((s) => s.method !== 'GET').length).toBe(0);
  });
});
