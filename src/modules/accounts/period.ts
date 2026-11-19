// Statement periods as business dates (ADR-F04 decision 6): calendar dates, YYYY-MM-DD, with no time zone.
// "Today" is the customer's calendar day; nothing here converts through UTC.

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** The customer's calendar date for an instant, as YYYY-MM-DD. */
export function calendarDate(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** From the first of the current month to today. */
export function currentMonth(today: Date): { from: string; to: string } {
  return { from: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`, to: calendarDate(today) };
}

/** A real calendar date in YYYY-MM-DD form. */
export function isBusinessDate(value: string): boolean {
  const match = DATE.exec(value);
  if (match === null) return false;
  const [, y = '', m = '', d = ''] = match;
  const year = Number.parseInt(y, 10);
  const month = Number.parseInt(m, 10);
  const day = Number.parseInt(d, 10);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export type PeriodProblem = 'invalid' | 'order' | 'future';

/** Shape only; finapp decides what it will serve (and answers when it will not). */
export function checkPeriod(from: string, to: string, today: string): PeriodProblem | undefined {
  if (!isBusinessDate(from) || !isBusinessDate(to)) return 'invalid';
  // YYYY-MM-DD strings order the same way as the dates they name.
  if (from > to) return 'order';
  if (to > today) return 'future';
  return undefined;
}
