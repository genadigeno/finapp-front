// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { endSession, sessionState } from '../../platform/session/session-store.ts';
import { empty, ISSUED, json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';

afterEach(() => endSession('signed-out'));

type User = ReturnType<typeof userEvent.setup>;

async function fill(user: User, current: string, next: string, repeat = next) {
  if (current !== '') await user.type(await screen.findByLabelText('Current password'), current);
  await user.type(screen.getByLabelText('New password'), next);
  await user.type(screen.getByLabelText('Repeat the new password'), repeat);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('security centre (P18-TSK-032)', () => {
  it('offers two-step verification, devices, password, details and consents', async () => {
    signInForTest();
    renderAppAt('/security', {});
    for (const name of [/Two-step verification/, /Signed-in devices/, /Password/, /Your details/, /Your consents/]) {
      expect(await screen.findByRole('link', { name })).toBeTruthy();
    }
  });

  it('signs out every other device in turn, leaving this one; one already gone is not an error', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/security/devices', {
      'GET /v1/sessions': [
        json([
          { id: 's-1', current: true, device: 'Firefox' },
          { id: 's-2', current: false, device: 'Phone' },
          { id: 's-3', current: false, device: 'Tablet' },
        ]),
        json([{ id: 's-1', current: true, device: 'Firefox' }]),
      ],
      'DELETE /v1/sessions/s-2': empty(),
      'DELETE /v1/sessions/s-3': problem(404, 'api.NotFound'),
    });
    await user.click(await screen.findByRole('button', { name: 'Sign out all other devices' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out all other devices?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sign out all other devices' }));
    expect(await screen.findByText('All other devices are signed out.')).toBeTruthy();
    expect(sent.filter((s) => s.method === 'DELETE').map((s) => s.path)).toEqual([
      '/v1/sessions/s-2',
      '/v1/sessions/s-3',
    ]);
    expect(sessionState().status).toBe('signed-in');
  });
});

describe('password change (P18-TSK-033)', () => {
  it('changes the password, takes up the rotated session at once, and sends no key', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent, router } = renderAppAt('/security/password', {
      'POST /v1/me/credential': json(ISSUED('PASSWORD', 'tok-rotated'), 201),
      'GET /v1/sessions': json([{ id: 's-9', current: true, device: 'Firefox' }]),
    });
    await fill(user, 'old secret 1', 'a much longer phrase');
    expect(await screen.findByText('Your password is changed')).toBeTruthy();
    const change = sent.find((s) => s.path === '/v1/me/credential');
    expect(change?.body).toEqual({ currentPassword: 'old secret 1', newPassword: 'a much longer phrase' });
    expect(change?.headers.get('Idempotency-Key')).toBeNull();
    expect(change?.headers.get('Authorization')).toBe('Bearer tok-test');
    // The next request goes with the new token.
    await router.navigate({ to: '/security/devices' });
    await waitFor(() =>
      expect(sent.find((s) => s.path === '/v1/sessions')?.headers.get('Authorization')).toBe('Bearer tok-rotated'),
    );
    // Nothing typed is left on screen.
    expect(document.body.textContent).not.toContain('a much longer phrase');
  });

  it('a wrong current password is not "signed out": the customer stays signed in and is told plainly', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/security/password', {
      'POST /v1/me/credential': problem(401, 'identity.AuthenticationFailed'),
    });
    await fill(user, 'wrong', 'a much longer phrase');
    expect(await screen.findByText('Your password was not changed')).toBeTruthy();
    expect(screen.getByText(/not right, or there were too many attempts/)).toBeTruthy();
    expect(screen.queryByText('You have been signed out')).toBeNull();
    expect(sessionState().status).toBe('signed-in');
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
  });

  it('with two-step verification, asks for a code first, then sends the same change', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/security/password', {
      'POST /v1/me/credential': [
        problem(403, 'identity.AssuranceRequired'),
        json(ISSUED('MULTI_FACTOR', 'tok-rotated'), 201),
      ],
      'POST /v1/authentications/mfa': json(ISSUED('MULTI_FACTOR', 'tok-up')),
    });
    await fill(user, 'old secret 1', 'a much longer phrase');
    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await user.type(within(dialog).getByLabelText('Authentication code'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Your password is changed')).toBeTruthy();
    const changes = sent.filter((s) => s.path === '/v1/me/credential');
    expect(changes).toHaveLength(2);
    expect(changes[1]?.body).toEqual(changes[0]?.body);
    expect(changes[1]?.headers.get('Authorization')).toBe('Bearer tok-up');
  });

  it('checks the length and the repeat before sending anything', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/security/password', {});
    await fill(user, 'old secret 1', 'short');
    expect(await screen.findByText('Use between 8 and 256 characters.')).toBeTruthy();
    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Repeat the new password'));
    await fill(user, '', 'a much longer phrase', 'a much longer phrasE');
    expect(await screen.findByText('The two new passwords are not the same.')).toBeTruthy();
    expect(sent.some((s) => s.path === '/v1/me/credential')).toBe(false);
  });
});

describe('your details (P18-TSK-034)', () => {
  const ME = {
    partyId: 'p-1',
    kind: 'PERSON',
    displayName: 'Ada',
    loginIdentifier: 'ada.l',
    registeredAt: '2026-11-01T09:00:00Z',
  };

  it('shows what finapp holds and changes the name', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/profile', {
      'GET /v1/me': [json(ME), json({ ...ME, displayName: 'Ada Lovelace' })],
      'PATCH /v1/me': json({ ...ME, displayName: 'Ada Lovelace' }),
    });
    expect(await screen.findByText('ada.l')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
    expect(screen.getByText('p-1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Your consents' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, '  Ada Lovelace ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your name is changed.')).toBeTruthy();
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
    expect(sent.find((s) => s.method === 'PATCH')?.body).toEqual({ displayName: 'Ada Lovelace' });
  });

  it('refuses an empty name and characters finapp refuses, without sending', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/profile', { 'GET /v1/me': json(ME) });
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a name.')).toBeTruthy();
    await user.type(name, `Ada${String.fromCharCode(0x200b)}`);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Use letters, numbers, spaces and punctuation only.')).toBeTruthy();
    expect(sent.some((s) => s.method === 'PATCH')).toBe(false);
  });
});
