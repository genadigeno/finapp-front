// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validReturnTo } from './return-to.ts';
import { ApiError, type ErrorCategory } from './api/api-error.ts';
import { CATEGORY_EXPLANATIONS, catalogueCodes, explain } from './api/problem-catalogue.ts';
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  PREFERENCES_KEY,
  preferencesColorSchemeManager,
  writePreferences,
} from './preferences.ts';
import { memoryCarrier, setCarrierForTests } from './session/carrier.ts';
import { parseCrossTabMessage } from './session/cross-tab.ts';
import {
  acceptIssuedSession,
  endSession,
  IDLE_TIMEOUT_MS,
  recordActivity,
  sessionState,
} from './session/session-store.ts';

describe('browser storage holds one allow-listed key (ADR-F07 decision 4; blueprint §22 item 9)', () => {
  beforeEach(() => window.localStorage.clear());

  it('writes only the preferences key, and only its allow-listed fields', () => {
    writePreferences({ colorScheme: 'dark', ...({ token: 'tok-1', balance: '10.00' } as object) });
    preferencesColorSchemeManager().set('light');
    expect(Object.keys(window.localStorage)).toEqual([PREFERENCES_KEY]);
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '{}')).toEqual({
      colorScheme: 'light',
      language: 'en',
    });
  });

  it('ignores a tampered value', () => {
    expect(parsePreferences('{"colorScheme":"<script>","language":"xx","token":"t"}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES);
  });

  it('nothing else in the application touches storage after a session lifecycle', () => {
    setCarrierForTests(memoryCarrier());
    acceptIssuedSession({ sessionToken: 'tok-secret', assurance: 'PASSWORD', expiresAt: '2026-11-19T12:30:00Z' });
    endSession('signed-out');
    expect(Object.keys(window.localStorage)).toEqual([]);
    expect(Object.keys(window.sessionStorage)).toEqual([]);
    expect(document.cookie).toBe('');
  });
});

describe('the session store (ADR-0030; P18-TSK-004)', () => {
  afterEach(() => endSession('signed-out'));

  it('accepts an issue, extends on activity, and forgets on end', () => {
    setCarrierForTests(memoryCarrier());
    acceptIssuedSession(
      { sessionToken: 't', assurance: 'MULTI_FACTOR', expiresAt: '2026-11-19T12:30:00Z' },
      Date.parse('2026-11-19T12:00:00Z'),
    );
    const state = sessionState();
    expect(state).toMatchObject({ status: 'signed-in', assurance: 'MULTI_FACTOR' });
    const later = Date.parse('2026-11-19T12:20:00Z');
    recordActivity(later);
    expect(sessionState()).toMatchObject({ idleExpiresAt: later + IDLE_TIMEOUT_MS });
    endSession('expired');
    expect(sessionState()).toEqual({ status: 'signed-out', reason: 'expired' });
  });

  it('never stores the token in its state', () => {
    setCarrierForTests(memoryCarrier());
    acceptIssuedSession({ sessionToken: 'tok-secret', assurance: 'PASSWORD', expiresAt: '2026-11-19T12:30:00Z' });
    expect(JSON.stringify(sessionState())).not.toContain('tok-secret');
  });

  it('refuses an issue without a readable expiry', () => {
    expect(() => acceptIssuedSession({ sessionToken: 't' })).toThrow();
  });
});

describe('cross-tab messages carry no data (ADR-F05 decision 8)', () => {
  it('accepts only the two message shapes', () => {
    expect(parseCrossTabMessage({ type: 'signed-out', extra: 'x' })).toEqual({ type: 'signed-out' });
    expect(parseCrossTabMessage({ type: 'invalidate', roots: ['accounts', 'BAD ROOT', 7] })).toEqual({
      type: 'invalidate',
      roots: ['accounts'],
    });
    expect(parseCrossTabMessage({ type: 'invalidate', roots: [] })).toBeUndefined();
    expect(parseCrossTabMessage({ type: 'data', balance: '10.00' })).toBeUndefined();
    expect(parseCrossTabMessage('signed-out')).toBeUndefined();
  });
});

describe('no open redirect after sign-in (ADR-F07 decision 7)', () => {
  it.each([
    ['/home', '/home'],
    ['https://evil.example/home', undefined],
    ['//evil.example', undefined],
    ['/home?x=1', undefined],
    ['/accounts/acc_123', undefined],
    [undefined, undefined],
  ])('%s -> %s', (input, expected) => {
    expect(validReturnTo(input)).toBe(expected);
  });
});

describe('every failure has customer words (blueprint §11.1)', () => {
  it('every category has a title and a next step', () => {
    const categories: ErrorCategory[] = [
      'validation',
      'unauthenticated',
      'assurance',
      'forbidden',
      'not-found',
      'refused',
      'in-progress',
      'stale',
      'rate-limited',
      'unavailable',
      'unknown-outcome',
      'defect',
    ];
    for (const category of categories) {
      expect(CATEGORY_EXPLANATIONS[category].title.defaultMessage).toBeTruthy();
      expect(CATEGORY_EXPLANATIONS[category].nextStep.defaultMessage).toBeTruthy();
    }
  });

  it('a code with its own wording uses it; others fall back to their category; non-API errors are defects', () => {
    const expired = new ApiError({
      kind: 'problem',
      method: 'POST',
      route: '/v1/x',
      status: 409,
      code: 'fx.QuoteExpired',
    });
    expect(explain(expired).title.id).toBe('problem.code.quoteExpired.title');
    const other = new ApiError({
      kind: 'problem',
      method: 'POST',
      route: '/v1/x',
      status: 409,
      code: 'lending.LoanClosed',
    });
    expect(explain(other)).toBe(CATEGORY_EXPLANATIONS.refused);
    expect(explain(new Error('boom'))).toBe(CATEGORY_EXPLANATIONS.defect);
  });

  it('never shows an internal code in its words', () => {
    for (const code of catalogueCodes()) {
      const error = new ApiError({ kind: 'problem', method: 'POST', route: '/v1/x', status: 409, code });
      const { title, nextStep } = explain(error);
      expect(`${String(title.defaultMessage)} ${String(nextStep.defaultMessage)}`).not.toContain(code);
    }
  });
});
