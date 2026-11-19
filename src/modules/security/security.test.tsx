// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { endSession, sessionState } from '../../platform/session/session-store.ts';
import { empty, ISSUED, json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';
import { groupKey, secretOf } from './MfaPage.tsx';

afterEach(() => endSession('signed-out'));

const PROFILE = json({ partyId: 'p-1', kind: 'PERSON', displayName: 'Ada', loginIdentifier: 'ada' });
const ONBOARDING_READS = {
  'GET /v1/me': PROFILE,
  'GET /v1/me/kyc': problem(404, 'api.NotFound'),
  'GET /v1/me/kyb': problem(404, 'api.NotFound'),
  'GET /v1/me/consents': json([]),
};

describe('sign-in (P18-TSK-010; blueprint §17 scenario 1)', () => {
  it('signs in and returns to the page that was asked for', async () => {
    const user = userEvent.setup();
    const { sent, router } = renderAppAt('/security/devices', {
      'POST /v1/authentications': json(ISSUED(), 201),
      'GET /v1/sessions': json([{ id: 's-1', current: true, device: 'Firefox', issuedAt: '2026-11-19T12:00:00Z' }]),
      ...ONBOARDING_READS,
    });
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.search).toEqual({ returnTo: '/security/devices' });
    await user.type(screen.getByLabelText('Login name'), 'ada');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Signed-in devices' })).toBeTruthy();
    expect(sessionState().status).toBe('signed-in');
    const signIn = sent.find((s) => s.path === '/v1/authentications');
    expect(signIn?.body).toEqual({ loginIdentifier: 'ada', password: 'correct horse' });
    expect(signIn?.headers.get('X-Finapp-Request')).toBe('1');
  });

  it('says the same thing for every refusal and forgets the password', async () => {
    const user = userEvent.setup();
    renderAppAt('/sign-in', { 'POST /v1/authentications': problem(401, 'identity.AuthenticationFailed') });
    await screen.findByRole('heading', { name: 'Sign in' });
    await user.type(screen.getByLabelText('Login name'), 'ada');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Sign-in failed. Check your login name and password/)).toBeTruthy();
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
    expect(sessionState().status).toBe('signed-out');
  });

  it('a signed-in customer opening sign-in goes home', async () => {
    signInForTest();
    const { router } = renderAppAt('/sign-in', ONBOARDING_READS);
    await screen.findByRole('heading', { name: 'Hello, Ada' });
    expect(router.state.location.pathname).toBe('/home');
  });

  it('a 401 on any read ends the session and returns to sign-in (scenario 3)', async () => {
    signInForTest();
    renderAppAt('/home', { ...ONBOARDING_READS, 'GET /v1/me': problem(401, 'api.Unauthenticated') });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(sessionState()).toMatchObject({ status: 'signed-out', reason: 'expired' });
  });
});

describe('signed-in devices', () => {
  it('lists sessions, marks this one, and signs out another after confirmation', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/security/devices', {
      'GET /v1/sessions': [
        json([
          { id: 's-1', current: true, device: 'Firefox on Linux', issuedAt: '2026-11-19T12:00:00Z' },
          { id: 's-2', current: false, device: 'Safari on iPhone', issuedAt: '2026-11-18T08:00:00Z' },
        ]),
        json([{ id: 's-1', current: true, device: 'Firefox on Linux', issuedAt: '2026-11-19T12:00:00Z' }]),
      ],
      'DELETE /v1/sessions/s-2': empty(),
    });
    await screen.findByText('Safari on iPhone');
    expect(screen.getByText('This device')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sign out this device' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out this device?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sign out this device' }));
    await waitFor(() => expect(screen.queryByText('Safari on iPhone')).toBeNull());
    expect(sent.some((s) => s.method === 'DELETE' && s.path === '/v1/sessions/s-2')).toBe(true);
  });
});

describe('two-step verification (P18-TSK-012)', () => {
  const URI =
    'otpauth://totp/finapp%3Aa1?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=finapp&algorithm=SHA1&digits=6&period=30';

  it('reads the key from the URI and groups it for typing', () => {
    expect(secretOf(URI)).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    expect(groupKey('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(secretOf('https://evil.example/?secret=JBSWY3DP')).toBeUndefined();
    expect(secretOf('otpauth://totp/x?secret=not-base32!')).toBeUndefined();
  });

  it('shows the key once, confirms a code, then forgets the key', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/security/two-step', {
      'POST /v1/me/mfa': json({ provisioningUri: URI, digits: 6, periodSeconds: 30 }, 201),
      'POST /v1/me/mfa/confirmation': [
        problem(422, 'api.ValidationFailed', { detail: 'That code did not confirm an enrolment.' }),
        empty(),
      ],
    });
    await user.click(await screen.findByRole('button', { name: 'Set up an authenticator app' }));
    expect(await screen.findByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeTruthy();
    await user.type(screen.getByLabelText('Code from your app'), '123456');
    await user.click(screen.getByRole('button', { name: 'Turn on two-step verification' }));
    expect(await screen.findByText(/That code did not work/)).toBeTruthy();
    await user.type(screen.getByLabelText('Code from your app'), '654321');
    await user.click(screen.getByRole('button', { name: 'Turn on two-step verification' }));
    expect(await screen.findByText('Two-step verification is on')).toBeTruthy();
    expect(screen.queryByText(/JBSW/)).toBeNull();
    expect(sent.filter((s) => s.path === '/v1/me/mfa/confirmation').map((s) => s.body)).toEqual([
      { code: '123456' },
      { code: '654321' },
    ]);
  });

  it('replacing an existing factor asks for a code first, then starts again', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/security/two-step', {
      'POST /v1/me/mfa': [problem(403, 'identity.AssuranceRequired'), json({ provisioningUri: URI, digits: 6 }, 201)],
      'POST /v1/authentications/mfa': json(ISSUED('MULTI_FACTOR', 'tok-rotated')),
    });
    await user.click(await screen.findByRole('button', { name: 'Set up an authenticator app' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm it is you' });
    await user.type(within(dialog).getByLabelText('Authentication code'), '111222');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeTruthy();
    const starts = sent.filter((s) => s.path === '/v1/me/mfa');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.headers.get('Authorization')).toBe('Bearer tok-rotated');
  });
});
