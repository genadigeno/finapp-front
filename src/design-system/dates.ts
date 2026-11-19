// Dates and instants (ADR-F04 decision 6).
//
// - A BUSINESS DATE (`postingDate`, `valueDate`, a due date) is a calendar date with no time zone. It is
//   read as YYYY-MM-DD and formatted in UTC, so no local offset can move it to the day before or after.
// - An INSTANT (`createdAt`, `expiresAt`) is a moment. It is shown in the customer's time zone, with the
//   zone named wherever the moment matters (receipts).

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type FormattedDate = { valid: true; text: string } | { valid: false; raw: string };

export function formatBusinessDate(value: string, locale: string): FormattedDate {
  const match = BUSINESS_DATE.exec(value.trim());
  if (match === null) return { valid: false, raw: value };
  const [, year = '', month = '', day = ''] = match;
  const utc = Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10));
  const check = new Date(utc);
  // 2026-02-30 is not a date: Date.UTC would roll it into March. Refuse it instead.
  if (check.getUTCDate() !== Number.parseInt(day, 10) || check.getUTCMonth() !== Number.parseInt(month, 10) - 1) {
    return { valid: false, raw: value };
  }
  return { valid: true, text: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(check) };
}

export function formatInstant(value: string, locale: string, options: { withZone?: boolean } = {}): FormattedDate {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return { valid: false, raw: value };
  const base = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
  if (options.withZone !== true) return { valid: true, text: base };
  // dateStyle/timeStyle cannot be combined with timeZoneName in one formatter; the zone comes from a second.
  const zone = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  return { valid: true, text: zone === undefined ? base : `${base} ${zone}` };
}
