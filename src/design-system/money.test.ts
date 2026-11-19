import { describe, expect, it } from 'vitest';
import { basisPointsToPercent, formatMoney, minorUnits, parseMoneyInput, separators } from './money.ts';

// ADR-F04: strings in, Intl out, nothing rounded, nothing lost (P18-TSK-005; blueprint §22 item 5).

const text = (amount: string, currency: string, locale = 'en-GB') => {
  const result = formatMoney(amount, currency, locale);
  if (!result.valid) throw new Error(`invalid: ${result.raw}`);
  return result.text;
};

describe('minor units come from the currency', () => {
  it.each([
    ['JPY', 0],
    ['EUR', 2],
    ['BHD', 3],
    ['XYZ', 2],
  ])('%s has %i', (currency, digits) => {
    expect(minorUnits(currency)).toBe(digits);
  });
});

describe('formatMoney - scales 0, 2 and 3', () => {
  it.each([
    ['1234', 'JPY', 'JP¥1,234'],
    ['1234.5', 'EUR', '€1,234.50'],
    ['0.5', 'BHD', 'BHD 0.500'],
    ['1234567.125', 'BHD', 'BHD 1,234,567.125'],
  ])('%s %s', (amount, currency, expected) => {
    expect(text(amount, currency).replace(/\s/g, ' ')).toBe(expected);
  });

  it('pads to the currency scale and never rounds extra precision away', () => {
    expect(text('10.125', 'EUR')).toBe('€10.125');
    expect(text('0.00000001', 'EUR')).toBe('€0.00000001');
    expect(text('1', 'JPY')).toBe('JP¥1');
  });

  it('keeps every digit of a value no float can hold', () => {
    const result = formatMoney('12345678901234567890.12', 'EUR', 'en-GB');
    expect(result.valid && result.text).toBe('€12,345,678,901,234,567,890.12');
    expect(result.valid && result.exact).toBe('intl');
  });

  it('formats in the customer locale', () => {
    expect(text('1234.5', 'EUR', 'de-DE').replace(/\s/g, ' ')).toBe('1.234,50 €');
  });

  it('a locale with its own numerals is verified digit for digit and kept exact', () => {
    const result = formatMoney('1234.56', 'EUR', 'ar-EG');
    expect(result.valid && result.exact).toBe('intl');
  });

  it('negatives keep their sign; a negative zero does not', () => {
    const negative = formatMoney('-5.00', 'EUR', 'en-GB');
    expect(negative.valid && negative.negative).toBe(true);
    expect(negative.valid && negative.text).toContain('5.00');
    const zero = formatMoney('-0.00', 'EUR', 'en-GB');
    expect(zero.valid && zero.negative).toBe(false);
    expect(zero.valid && zero.text).toBe('€0.00');
  });

  it('refuses what is not a decimal with a currency', () => {
    expect(formatMoney('1e3', 'EUR', 'en').valid).toBe(false);
    expect(formatMoney('12,50', 'EUR', 'en').valid).toBe(false);
    expect(formatMoney('10', 'eur', 'en').valid).toBe(false);
    expect(formatMoney('', 'EUR', 'en').valid).toBe(false);
  });
});

describe('parseMoneyInput - what a customer types', () => {
  it.each([
    ['1234.50', 'EUR', 'en-GB', '1234.50'],
    ['1,234.50', 'EUR', 'en-GB', '1234.50'],
    ['1.234,50', 'EUR', 'de-DE', '1234.50'],
    ['0012', 'JPY', 'en', '12'],
    ['0.125', 'BHD', 'en', '0.125'],
  ])('%s (%s, %s) reads as %s', (typed, currency, locale, amount) => {
    expect(parseMoneyInput(typed, currency, locale)).toEqual({ ok: true, amount });
  });

  it('accepts the space groupings some locales use', () => {
    const { group } = separators('fr-FR');
    expect(parseMoneyInput(`1${group}234,50`, 'EUR', 'fr-FR')).toEqual({ ok: true, amount: '1234.50' });
  });

  it.each([
    ['', 'EUR', 'empty'],
    ['abc', 'EUR', 'format'],
    ['-5', 'EUR', 'format'],
    ['1e3', 'EUR', 'format'],
    ['10.', 'EUR', 'format'],
    ['10.123', 'EUR', 'scale'],
    ['10.5', 'JPY', 'scale'],
    ['0.00', 'EUR', 'zero'],
  ])('refuses %j for %s as %s', (typed, currency, problem) => {
    expect(parseMoneyInput(typed, currency, 'en-GB')).toEqual({ ok: false, problem });
  });
});

describe('basis points by string arithmetic', () => {
  it.each([
    ['1250', '12.50'],
    ['5', '0.05'],
    ['0', '0.00'],
    ['10000', '100.00'],
    ['-75', '-0.75'],
  ])('%s bp is %s%%', (bp, percent) => {
    expect(basisPointsToPercent(bp)).toBe(percent);
  });

  it('refuses a non-integer', () => {
    expect(basisPointsToPercent('12.5')).toBeUndefined();
  });
});
