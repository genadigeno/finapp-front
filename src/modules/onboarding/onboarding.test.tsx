// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { percentToBasisPoints } from '../../design-system/money.ts';
import { endSession, sessionState } from '../../platform/session/session-store.ts';
import { empty, ISSUED, json, problem, renderAppAt, signInForTest } from '../../testing/scripted-finapp.tsx';
import { checkFile, MAX_DOCUMENT_BYTES, toBase64 } from './kyc.ts';

afterEach(() => endSession('signed-out'));

const PROFILE = json({ partyId: '0190a3c1-aaaa-7222-8333-444455556666', kind: 'PERSON', displayName: 'Ada' });
const KYC_CONSENT = (granted: boolean) => ({
  purpose: 'KYC_PROCESSING',
  granted,
  currentTextVersion: 3,
  currentText: 'We check your identity with our verification provider.',
});

describe('registration (P18-TSK-011)', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole('heading', { name: 'Open an account' });
    await user.type(screen.getByLabelText('Your name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Login name'), 'ada.l');
    await user.type(screen.getByLabelText('Password'), 'analytical engine');
    await user.type(screen.getByLabelText('Repeat the password'), 'analytical engine');
    await user.click(screen.getByRole('button', { name: 'Open my account' }));
  }

  it('registers under an idempotency key, then signs in with the same credentials and goes home', async () => {
    const user = userEvent.setup();
    const { sent } = renderAppAt('/register', {
      'POST /v1/registrations': empty(201),
      'POST /v1/authentications': json(ISSUED(), 201),
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyc': problem(404, 'api.NotFound'),
      'GET /v1/me/kyb': problem(404, 'api.NotFound'),
      'GET /v1/me/consents': json([KYC_CONSENT(false)]),
    });
    await fill(user);
    expect(await screen.findByRole('heading', { name: 'Hello, Ada' })).toBeTruthy();
    const registration = sent.find((s) => s.path === '/v1/registrations');
    expect(registration?.body).toEqual({
      displayName: 'Ada Lovelace',
      loginIdentifier: 'ada.l',
      password: 'analytical engine',
    });
    expect(registration?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.find((s) => s.path === '/v1/authentications')?.body).toEqual({
      loginIdentifier: 'ada.l',
      password: 'analytical engine',
    });
    expect(sessionState().status).toBe('signed-in');
  });

  it('checks shape before sending: login charset, password length, matching repeat', async () => {
    const user = userEvent.setup();
    const { sent } = renderAppAt('/register', {});
    await screen.findByRole('heading', { name: 'Open an account' });
    await user.type(screen.getByLabelText('Your name'), 'Ada');
    await user.type(screen.getByLabelText('Login name'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Repeat the password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Open my account' }));
    expect(await screen.findByText(/Use 3 to 64 letters/)).toBeTruthy();
    expect(screen.getByText('Use between 8 and 256 characters.')).toBeTruthy();
    expect(sent.filter((s) => s.path === '/v1/registrations')).toEqual([]);
  });

  it('a refusal is uniform and says nothing about whether the login name exists', async () => {
    const user = userEvent.setup();
    renderAppAt('/register', { 'POST /v1/registrations': problem(422, 'party.RegistrationRefused') });
    await fill(user);
    expect(await screen.findByText('We could not open your account')).toBeTruthy();
    expect(screen.queryByText(/taken|exists/i)).toBeNull();
  });

  it('an unknown outcome is re-sent with the SAME key (scenario 5)', async () => {
    const user = userEvent.setup();
    const { sent } = renderAppAt('/register', {
      'POST /v1/registrations': [problem(500, 'api.InternalError'), empty(201)],
      'POST /v1/authentications': json(ISSUED(), 201),
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyc': problem(404, 'api.NotFound'),
      'GET /v1/me/kyb': problem(404, 'api.NotFound'),
      'GET /v1/me/consents': json([]),
    });
    await fill(user);
    await user.click(await screen.findByRole('button', { name: 'Send the same request again' }));
    await screen.findByRole('heading', { name: 'Hello, Ada' });
    const keys = sent.filter((s) => s.path === '/v1/registrations').map((s) => s.headers.get('Idempotency-Key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('consents (P18-TSK-013)', () => {
  it('shows the text finapp serves and grants that exact version', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/onboarding/consents', {
      'GET /v1/me/consents': [json([KYC_CONSENT(false)]), json([KYC_CONSENT(true)])],
      'POST /v1/me/consents': json(KYC_CONSENT(true), 201),
    });
    expect(await screen.findByText('We check your identity with our verification provider.')).toBeTruthy();
    expect(screen.getByText('Text version 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'I agree' }));
    expect(await screen.findByText('You agreed')).toBeTruthy();
    expect(sent.find((s) => s.method === 'POST')?.body).toEqual({ purpose: 'KYC_PROCESSING', textVersion: 3 });
  });

  it('withdraws only after confirmation', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/onboarding/consents', {
      'GET /v1/me/consents': [json([KYC_CONSENT(true)]), json([KYC_CONSENT(false)])],
      'DELETE /v1/me/consents/KYC_PROCESSING': empty(),
    });
    await user.click(await screen.findByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw this consent?' });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('Not agreed')).toBeTruthy();
    expect(sent.some((s) => s.method === 'DELETE')).toBe(true);
  });
});

describe('identity verification (P18-TSK-014; scenario 12)', () => {
  it('asks for consent first, then starts verification', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/onboarding/identity', {
      'GET /v1/me/kyc': [problem(404, 'api.NotFound'), problem(404, 'api.NotFound'), json({ status: 'OPEN' })],
      'GET /v1/me/consents': [json([KYC_CONSENT(false)]), json([KYC_CONSENT(true)])],
      'POST /v1/me/consents': json(KYC_CONSENT(true), 201),
      'POST /v1/me/kyc': json({ status: 'OPEN' }, 201),
    });
    expect(await screen.findByText('First, agree to us checking your identity.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start verification' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'I agree' }));
    await user.click(await screen.findByRole('button', { name: 'Start verification' }));
    expect(await screen.findByRole('heading', { name: 'Add your documents' })).toBeTruthy();
    expect(sent.some((s) => s.method === 'POST' && s.path === '/v1/me/kyc')).toBe(true);
  });

  it('explains finapp refusing to start without consent', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/onboarding/identity', {
      'GET /v1/me/kyc': problem(404, 'api.NotFound'),
      'GET /v1/me/consents': json([KYC_CONSENT(true)]),
      'POST /v1/me/kyc': problem(409, 'consent.ConsentRequired'),
    });
    await user.click(await screen.findByRole('button', { name: 'Start verification' }));
    expect(await screen.findByText('Your consent is needed first')).toBeTruthy();
  });

  it('uploads a document as base64 with finapp’s type names, and refuses an oversized file before sending', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/onboarding/identity', {
      'GET /v1/me/kyc': json({ status: 'OPEN' }),
      'GET /v1/me/consents': json([KYC_CONSENT(true)]),
      'POST /v1/me/kyc/documents': json({ documentId: 'd-1' }, 201),
    });
    await screen.findByRole('heading', { name: 'Add your documents' });
    const select = screen.getAllByLabelText('Document').find((element) => element.tagName === 'INPUT');
    if (select === undefined) throw new Error('no document select');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Passport' }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('no file input');
    await user.upload(input, new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], 'big.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Add document' }));
    expect(await screen.findByText(/larger than 512 KB/)).toBeTruthy();
    expect(sent.filter((s) => s.path === '/v1/me/kyc/documents')).toEqual([]);

    await user.upload(input, new File([new Uint8Array([1, 2, 3])], 'passport.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: 'Add document' }));
    expect(await screen.findByText('Passport - received')).toBeTruthy();
    expect(sent.find((s) => s.path === '/v1/me/kyc/documents')?.body).toEqual({
      documentType: 'PASSPORT',
      contentType: 'JPEG',
      content: 'AQID',
    });
  });

  it('file checks and encoding', () => {
    expect(checkFile({ type: 'image/gif', size: 10 })).toBe('type');
    expect(checkFile({ type: 'application/pdf', size: 0 })).toBe('empty');
    expect(checkFile({ type: 'image/png', size: MAX_DOCUMENT_BYTES })).toBeUndefined();
    expect(toBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    expect(toBase64(new Uint8Array(100_000)).length).toBe(133_336);
  });
});

describe('business (P18-TSK-015)', () => {
  it('registers a business when there is none', async () => {
    const user = userEvent.setup();
    signInForTest();
    const { sent } = renderAppAt('/business', {
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyb': [problem(404, 'api.NotFound'), json({ status: 'OPEN', owners: [] })],
      'POST /v1/me/organisations': json({ organisationId: 'o-1', customerId: 'c-1' }, 201),
    });
    await user.type(await screen.findByLabelText('Registered name of the business'), 'Analytical Engines Ltd');
    await user.click(screen.getByRole('button', { name: 'Register business' }));
    expect(await screen.findByText('No one has been declared yet.')).toBeTruthy();
    expect(sent.find((s) => s.path === '/v1/me/organisations')?.body).toEqual({ name: 'Analytical Engines Ltd' });
  });

  it('declares the registrant as an owner by their own reference, the share in basis points', async () => {
    const user = userEvent.setup();
    signInForTest();
    const owner = {
      ownerPartyId: '0190a3c1-aaaa-7222-8333-444455556666',
      stakeBasisPoints: 2550,
      controlRole: 'DIRECTOR',
      declaredAt: '2026-11-19T12:00:00Z',
      verificationPending: true,
    };
    const { sent } = renderAppAt('/business', {
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyb': [json({ status: 'OPEN', owners: [] }), json({ status: 'OPEN', owners: [owner] })],
      'POST /v1/me/kyb/owners': empty(201),
    });
    await user.click(await screen.findByRole('button', { name: 'Declare myself' }));
    await user.type(screen.getByLabelText('Share they own (%)'), '25.5');
    await user.click(screen.getByRole('button', { name: 'Declare' }));
    expect(await screen.findByText('25.50%')).toBeTruthy();
    expect(screen.getByText('Identity check pending')).toBeTruthy();
    expect(sent.find((s) => s.path === '/v1/me/kyb/owners')?.body).toEqual({
      ownerPartyId: '0190a3c1-aaaa-7222-8333-444455556666',
      stakeBasisPoints: 2550,
    });
  });

  it('needs a share or a role, and explains finapp’s refusal of an ineligible person', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderAppAt('/business', {
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyb': json({ status: 'OPEN', owners: [] }),
      'POST /v1/me/kyb/owners': problem(422, 'kyc.OwnerNotEligible'),
    });
    await user.type(
      await screen.findByLabelText("The person's customer reference"),
      '0190a3c1-bbbb-7222-8333-444455556666',
    );
    await user.click(screen.getByRole('button', { name: 'Declare' }));
    expect(await screen.findByText('Enter a share, a control role, or both.')).toBeTruthy();
    await user.type(screen.getByLabelText('Share they own (%)'), '10');
    await user.click(screen.getByRole('button', { name: 'Declare' }));
    expect(await screen.findByText('We cannot add this person')).toBeTruthy();
  });

  it('percent to basis points by string arithmetic', () => {
    expect(percentToBasisPoints('25')).toBe('2500');
    expect(percentToBasisPoints('25.5')).toBe('2550');
    expect(percentToBasisPoints('0.01')).toBe('1');
    expect(percentToBasisPoints('100')).toBe('10000');
    expect(percentToBasisPoints('12,75')).toBe('1275');
    expect(percentToBasisPoints('1.005')).toBeUndefined();
    expect(percentToBasisPoints('-5')).toBeUndefined();
  });
});

describe('the onboarding checklist reflects finapp, not the browser (P18-TSK-016)', () => {
  it('a new customer is asked to agree and verify; business and two-step are offered', async () => {
    signInForTest();
    renderAppAt('/home', {
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyc': problem(404, 'api.NotFound'),
      'GET /v1/me/kyb': problem(404, 'api.NotFound'),
      'GET /v1/me/consents': json([KYC_CONSENT(false)]),
    });
    expect(await screen.findByText('Start by agreeing to identity checks.')).toBeTruthy();
    expect(screen.getByText('Acting for a business?')).toBeTruthy();
    expect(screen.getByText('Protect your account with two-step verification')).toBeTruthy();
    expect(screen.getByText('0190a3c1-aaaa-7222-8333-444455556666')).toBeTruthy();
  });

  it('shows finapp’s status for the identity and the business', async () => {
    signInForTest();
    renderAppAt('/home', {
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyc': json({ status: 'APPROVED' }),
      'GET /v1/me/kyb': json({ status: 'IN_PROGRESS', owners: [] }),
      'GET /v1/me/consents': json([KYC_CONSENT(true)]),
      'GET /v1/me/accounts': json([]),
    });
    await waitFor(() => expect(screen.getByText('Verified')).toBeTruthy());
    expect(screen.getByText('Under review')).toBeTruthy();
    expect(screen.getByText('Your business')).toBeTruthy();
  });

  it('navigation offers only pages that exist', async () => {
    signInForTest();
    renderAppAt('/home', {
      'GET /v1/me': PROFILE,
      'GET /v1/me/kyc': problem(404, 'api.NotFound'),
      'GET /v1/me/kyb': problem(404, 'api.NotFound'),
      'GET /v1/me/consents': json([]),
      'GET /v1/me/accounts': json([]),
    });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Home', 'Accounts', 'Activity', 'Business', 'Security']);
  });
});
