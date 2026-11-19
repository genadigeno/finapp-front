import { describe, expect, it } from 'vitest';
import { formatBusinessDate, formatInstant } from './dates.ts';
import {
  APPLICATION_STATUS,
  BNPL_AGREEMENT_STATUS,
  CHECKOUT_STATUS,
  CREDIT_OUTCOME,
  CREDIT_REQUEST_STATUS,
  CROSS_BORDER_STATUS,
  DISPUTE_STATUS,
  INSTALMENT_STATUS,
  OFFER_STATUS,
  FX_QUOTE_STATUS,
  KYC_STATUS,
  LOAN_STATUS,
  PAYMENT_INTENT_STATUS,
  presentStatus,
  TRANSFER_STATUS,
  UNKNOWN_STATUS,
  WITHDRAWAL_STATUS,
} from './status.ts';

describe('status maps (blueprint §7)', () => {
  const maps = {
    TRANSFER_STATUS,
    PAYMENT_INTENT_STATUS,
    WITHDRAWAL_STATUS,
    FX_QUOTE_STATUS,
    CROSS_BORDER_STATUS,
    KYC_STATUS,
    LOAN_STATUS,
    CREDIT_REQUEST_STATUS,
    CREDIT_OUTCOME,
    APPLICATION_STATUS,
    OFFER_STATUS,
    INSTALMENT_STATUS,
    BNPL_AGREEMENT_STATUS,
    DISPUTE_STATUS,
    CHECKOUT_STATUS,
  };

  it('an unknown value is "in progress - check back", never an error and never success', () => {
    for (const map of Object.values(maps)) {
      expect(presentStatus('SOMETHING_NEW', map)).toBe(UNKNOWN_STATUS);
      expect(presentStatus('toString', map)).toBe(UNKNOWN_STATUS);
    }
    expect(UNKNOWN_STATUS.tone).toBe('neutral');
    expect(UNKNOWN_STATUS.terminal).toBe(false);
  });

  it('an outcome that may still change is never shown as success', () => {
    for (const map of Object.values(maps)) {
      for (const presentation of Object.values(map)) {
        if (presentation.tone === 'positive' && !presentation.terminal) {
          // Only an ACTIVE loan or pay-later agreement is positive and ongoing: a state, not an outcome.
          expect([LOAN_STATUS.ACTIVE, BNPL_AGREEMENT_STATUS.ACTIVE]).toContain(presentation);
        }
      }
    }
  });

  it('a written-off balance is still owed: never shown as settled', () => {
    expect(LOAN_STATUS.WRITTEN_OFF.tone).toBe('caution');
    expect(BNPL_AGREEMENT_STATUS.WRITTEN_OFF.tone).toBe('caution');
  });

  it('a withdrawal whose outcome finapp is still finding out is caution, not failure (ADR-F05)', () => {
    expect(WITHDRAWAL_STATUS.UNKNOWN.tone).toBe('caution');
    expect(WITHDRAWAL_STATUS.UNKNOWN.terminal).toBe(false);
  });

  it('no message ids collide across maps with different wording', () => {
    const byId = new Map<string, string | undefined>();
    for (const map of Object.values(maps)) {
      for (const { label } of Object.values(map)) {
        const id = String(label.id);
        const text = typeof label.defaultMessage === 'string' ? label.defaultMessage : undefined;
        if (byId.has(id)) expect(byId.get(id)).toBe(text);
        byId.set(id, text);
      }
    }
  });
});

describe('business dates never move (ADR-F04 decision 6)', () => {
  it('formats the calendar date as given, in any time zone', () => {
    const result = formatBusinessDate('2026-01-01', 'en-GB');
    expect(result).toEqual({ valid: true, text: '1 Jan 2026' });
  });

  it('refuses a date that does not exist rather than rolling it over', () => {
    expect(formatBusinessDate('2026-02-30', 'en-GB').valid).toBe(false);
    expect(formatBusinessDate('2026-1-1', 'en-GB').valid).toBe(false);
    expect(formatBusinessDate('2026-01-01T00:00:00Z', 'en-GB').valid).toBe(false);
  });

  it('instants carry their zone when asked', () => {
    const result = formatInstant('2026-11-19T12:00:00Z', 'en-GB', { withZone: true });
    expect(result.valid).toBe(true);
    expect(result.valid && /\d{2}:\d{2}/.test(result.text)).toBe(true);
    expect(formatInstant('not a time', 'en-GB').valid).toBe(false);
  });
});
