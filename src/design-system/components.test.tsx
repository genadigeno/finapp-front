// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../platform/api/api-error.ts';
import { renderWithProviders } from '../testing/render.tsx';
import { StepUpDialog } from './Dialogs.tsx';
import { ErrorExplained, UnknownOutcome } from './States.tsx';
import { TRANSFER_STATUS } from './status.ts';
import { BalanceTriplet, Countdown, Money, MoneyInput, StatusChip } from './Values.tsx';
import { ReviewPanel } from './Workflow.tsx';

describe('value components (ADR-F04)', () => {
  it('Money renders the exact amount in the locale', () => {
    renderWithProviders(<Money amount="1234.5" currency="EUR" />);
    expect(screen.getByText('€1,234.50')).toBeTruthy();
  });

  it('Money says an unreadable amount is unreadable instead of guessing', () => {
    renderWithProviders(<Money amount="12,5" currency="EUR" />);
    expect(screen.getByText(/could not be read/)).toBeTruthy();
  });

  it('BalanceTriplet labels each figure and never adds them up', () => {
    renderWithProviders(
      <BalanceTriplet currency="EUR" available="70.00" settled="100.00" holds="30.00" asOf="2026-11-19T12:00:00Z" />,
    );
    expect(screen.getByText('€70.00')).toBeTruthy();
    expect(screen.getByText('€100.00')).toBeTruthy();
    expect(screen.getByText('€30.00')).toBeTruthy();
    expect(screen.queryByText('€130.00')).toBeNull();
    expect(screen.getByText(/Balance as of/)).toBeTruthy();
  });

  it('MoneyInput shows the currency and the problem in words', () => {
    renderWithProviders(
      <MoneyInput label="Amount" value="10.123" onChange={() => undefined} currency="EUR" problem="scale" />,
    );
    expect(screen.getByText('EUR')).toBeTruthy();
    expect(screen.getByText('EUR amounts have at most 2 decimals.')).toBeTruthy();
  });

  it('StatusChip shows customer words, and an unknown value as in progress', () => {
    renderWithProviders(
      <>
        <StatusChip value="COMPLETED" map={TRANSFER_STATUS} />
        <StatusChip value="SOMETHING_NEW" map={TRANSFER_STATUS} />
      </>,
    );
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('In progress - check back')).toBeTruthy();
  });

  it('Countdown reports expiry so confirmation can be disabled', async () => {
    const onExpire = vi.fn();
    renderWithProviders(
      <Countdown expiresAt="2026-11-19T12:00:00Z" now={() => Date.parse('2026-11-19T12:00:01Z')} onExpire={onExpire} />,
    );
    expect(screen.getByRole('timer').textContent).toBe('Expired');
    await waitFor(() => expect(onExpire).toHaveBeenCalled());
  });
});

describe('ReviewPanel sends once (ADR-F05 decision 5; blueprint §17 scenario 6)', () => {
  it('a double click confirms exactly once and the control stays disabled', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    renderWithProviders(
      <ReviewPanel
        title="Review your transfer"
        rows={[{ label: 'Amount', value: '€10.00', emphasis: true }]}
        onConfirm={onConfirm}
      />,
    );
    const button = screen.getByRole('button', { name: 'Confirm' });
    await user.dblClick(button);
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true),
    );
  });

  it('an expired quote disables confirmation', () => {
    renderWithProviders(<ReviewPanel title="Review" rows={[]} confirmDisabled onConfirm={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('states', () => {
  it('an explained error shows words and the reference, never the internal code', () => {
    const error = new ApiError({
      kind: 'problem',
      method: 'POST',
      route: '/v1/me/fx/conversions',
      status: 409,
      code: 'fx.QuoteExpired',
      correlationId: '0190a3c1-1111-7222-8333-444455556666',
    });
    const { container } = renderWithProviders(<ErrorExplained error={error} />);
    expect(screen.getByText('Your quote has expired')).toBeTruthy();
    expect(screen.getByText('0190a3c1-1111-7222-8333-444455556666')).toBeTruthy();
    expect(container.textContent).not.toContain('fx.QuoteExpired');
  });

  it('an unknown outcome is not a failure and offers to check first', () => {
    renderWithProviders(<UnknownOutcome onCheck={() => undefined} onSendSame={() => undefined} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Check status' })).toBeTruthy();
  });
});

describe('StepUpDialog (ADR-F02, ADR-F05 decision 2)', () => {
  it('submits a 6-digit code and explains a refusal without keeping the code', async () => {
    const user = userEvent.setup();
    const refused = new ApiError({
      kind: 'problem',
      method: 'POST',
      route: '/v1/authentications/mfa',
      status: 401,
      code: 'identity.AuthenticationFailed',
    });
    const onSubmit = vi.fn<(code: string) => Promise<void>>().mockRejectedValueOnce(refused).mockResolvedValueOnce();
    renderWithProviders(<StepUpDialog opened onSubmit={onSubmit} onCancel={() => undefined} />);
    const field = screen.getByLabelText('Authentication code');
    await user.type(field, '12a3456');
    expect((field as HTMLInputElement).value).toBe('123456');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSubmit).toHaveBeenCalledWith('123456');
    expect(await screen.findByText('Check your login and password and try again.')).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('refuses a short code before sending anything', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    renderWithProviders(<StepUpDialog opened onSubmit={onSubmit} onCancel={() => undefined} />);
    await user.type(screen.getByLabelText('Authentication code'), '123');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the 6 digits shown in your app.')).toBeTruthy();
  });
});
