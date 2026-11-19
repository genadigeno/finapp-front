// Money in the browser: strings in, Intl out, no arithmetic (ADR-F04; P18-TSK-005).
//
// An amount arrives from finapp as a decimal STRING with its ISO 4217 currency and never becomes a
// JavaScript number. It is formatted by `Intl.NumberFormat` given the STRING (ES2023: a string is an exact
// decimal, not a float), in the customer's locale, with:
//   - at least the currency's minor units (JPY 0, EUR 2, BHD 3) - padded, never rounded;
//   - every digit finapp sent beyond them (a rate leg, a sub-unit) - shown, never cut.
// The result is checked digit-for-digit against the input. An engine that would round through a float
// fails that check, and the amount is formatted by string manipulation instead (fallback), so no figure
// is ever shown that finapp did not send.

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;
const CURRENCY = /^[A-Z]{3}$/;
/** Intl's limit on fraction digits. */
const MAX_INTL_FRACTION = 100;
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

export type FormattedMoney =
  | { valid: true; text: string; currency: string; negative: boolean; exact: 'intl' | 'fallback' }
  | { valid: false; raw: string };

/** ISO 4217 minor units, as the platform's Intl data knows them; 2 for a code it does not. */
export function minorUnits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

interface Decimal {
  negative: boolean;
  integer: string;
  fraction: string;
}

function parseDecimal(amount: string): Decimal | undefined {
  const match = DECIMAL.exec(amount.trim());
  if (match === null) return undefined;
  const [, sign, integerDigits = '0', fractionDigits = ''] = match;
  const integer = integerDigits.replace(/^0+(?=\d)/, '');
  const isZero = /^0*$/.test(integer + fractionDigits);
  return { negative: sign === '-' && !isZero, integer, fraction: fractionDigits };
}

export function formatMoney(amount: string, currency: string, locale: string): FormattedMoney {
  const decimal = parseDecimal(amount);
  if (decimal === undefined || !CURRENCY.test(currency)) return { valid: false, raw: `${amount} ${currency}`.trim() };

  const digits = Math.max(decimal.fraction.length, minorUnits(currency));
  const fraction = decimal.fraction.padEnd(digits, '0');
  const canonical = `${decimal.negative ? '-' : ''}${decimal.integer}${fraction === '' ? '' : `.${fraction}`}`;

  const viaIntl = digits <= MAX_INTL_FRACTION ? formatWithIntl(canonical, currency, locale, digits) : undefined;
  if (viaIntl !== undefined && sameDigits(viaIntl.parts, decimal.integer, fraction)) {
    return { valid: true, text: viaIntl.text, currency, negative: decimal.negative, exact: 'intl' };
  }
  return {
    valid: true,
    text: fallbackText(decimal, fraction, currency),
    currency,
    negative: decimal.negative,
    exact: 'fallback',
  };
}

function formatWithIntl(
  canonical: string,
  currency: string,
  locale: string,
  digits: number,
): { text: string; parts: Intl.NumberFormatPart[] } | undefined {
  try {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    };
    // ES2023 Intl.NumberFormat v3: a numeric string is formatted as an exact decimal.
    const value = canonical as `${number}`;
    // The check runs in Latin digits, so a locale with its own numerals is verified by the same rule.
    const check = new Intl.NumberFormat(locale, { ...options, numberingSystem: 'latn' });
    return { text: new Intl.NumberFormat(locale, options).format(value), parts: check.formatToParts(value) };
  } catch {
    return undefined;
  }
}

/** The formatted integer and fraction digits are exactly the input's: nothing rounded, nothing lost. */
function sameDigits(parts: Intl.NumberFormatPart[], integer: string, fraction: string): boolean {
  const integerOut = parts
    .filter((p) => p.type === 'integer')
    .map((p) => p.value)
    .join('');
  const fractionOut = parts
    .filter((p) => p.type === 'fraction')
    .map((p) => p.value)
    .join('');
  return integerOut === integer && fractionOut === fraction;
}

function fallbackText(decimal: Decimal, fraction: string, currency: string): string {
  const grouped = decimal.integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${decimal.negative ? '-' : ''}${grouped}${fraction === '' ? '' : `.${fraction}`} ${currency}`;
}

/** The decimal and grouping separators of a locale, for reading what a customer types. */
export function separators(locale: string): { decimal: string; group: string } {
  try {
    const parts = new Intl.NumberFormat(locale, { useGrouping: true }).formatToParts('11111.1' as `${number}`);
    return {
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
    };
  } catch {
    return { decimal: '.', group: ',' };
  }
}

export type MoneyInputProblem = 'empty' | 'format' | 'scale' | 'zero';

export type ParsedMoneyInput = { ok: true; amount: string } | { ok: false; problem: MoneyInputProblem };

/**
 * Reads an amount the customer typed, in their locale, into the decimal string finapp accepts. Positive
 * amounts only (the direction is the operation's, never a sign); never more decimals than the currency
 * has. It validates shape only - finapp validates again and decides everything else (ADR-F04 decision 3).
 */
export function parseMoneyInput(text: string, currency: string, locale: string): ParsedMoneyInput {
  const { decimal, group } = separators(locale);
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, problem: 'empty' };
  // Grouping separators (and the spaces some locales group with) are cosmetic.
  // \s covers the no-break space; the narrow no-break space (U+202F) and the apostrophe (de-CH) are named.
  const ungrouped = trimmed.split(group).join('').split(NARROW_NO_BREAK_SPACE).join('').replace(/[\s']/g, '');
  const normalised = ungrouped.split(decimal).join('.');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalised);
  if (match === null) return { ok: false, problem: 'format' };
  const [, integerDigits = '0', fractionDigits = ''] = match;
  if (fractionDigits.length > minorUnits(currency)) return { ok: false, problem: 'scale' };
  const integer = integerDigits.replace(/^0+(?=\d)/, '');
  if (/^0*$/.test(integer + fractionDigits)) return { ok: false, problem: 'zero' };
  return { ok: true, amount: fractionDigits === '' ? integer : `${integer}.${fractionDigits}` };
}

/**
 * A rate in basis points (an integer string, e.g. "1250") as a percentage string ("12.50"), by string
 * arithmetic only.
 */
export function basisPointsToPercent(basisPoints: string): string | undefined {
  const match = /^(-)?(\d+)$/.exec(basisPoints.trim());
  if (match === null) return undefined;
  const [, sign = '', digits = '0'] = match;
  const padded = digits.padStart(3, '0');
  const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  const negative = sign === '-' && !/^0+$/.test(digits);
  return `${negative ? '-' : ''}${integer}.${padded.slice(-2)}`;
}

/**
 * A percentage the customer typed ("25", "12.5", "0.01") as basis points ("2500", "1250", "1"), by string
 * arithmetic only. At most two decimals (a basis point is 0.01%); undefined for anything else.
 */
export function percentToBasisPoints(percent: string): string | undefined {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(percent.trim());
  if (match === null) return undefined;
  const [, whole = '0', fraction = ''] = match;
  const digits = `${whole}${fraction.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
  return digits;
}

/**
 * A fraction as a percentage, by moving the decimal point - no arithmetic on floats ("0.004500" -> "0.45").
 * Trailing zeros beyond two decimals are dropped; undefined for anything that is not a plain decimal.
 */
export function fractionToPercent(fraction: string): string | undefined {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(fraction.trim());
  if (match === null) return undefined;
  const [, whole = '0', decimals = ''] = match;
  const padded = decimals.padEnd(2, '0');
  const integer = `${whole}${padded.slice(0, 2)}`.replace(/^0+(?=\d)/, '');
  const rest = padded.slice(2).replace(/0+$/, '');
  return `${integer}.${rest.padEnd(2, '0')}`;
}
