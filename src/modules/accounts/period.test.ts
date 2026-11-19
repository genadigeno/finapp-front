import { describe, expect, it } from 'vitest';
import { calendarDate, checkPeriod, currentMonth, isBusinessDate } from './period.ts';

describe('statement periods are calendar dates (ADR-F04 decision 6)', () => {
  it('reads the customer’s own calendar day, not UTC', () => {
    // 23:30 local on 31 Dec is still 31 Dec for the customer, whatever UTC says.
    expect(calendarDate(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
    expect(currentMonth(new Date(2026, 10, 19, 9))).toEqual({ from: '2026-11-01', to: '2026-11-19' });
  });

  it.each([
    ['2026-02-28', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['2026-1-01', false],
    ['', false],
  ])('%s is a date: %s', (value, expected) => {
    expect(isBusinessDate(value)).toBe(expected);
  });

  it('checks order and the future, nothing more', () => {
    expect(checkPeriod('2026-11-01', '2026-11-19', '2026-11-19')).toBeUndefined();
    expect(checkPeriod('2026-11-20', '2026-11-19', '2026-11-30')).toBe('order');
    expect(checkPeriod('2026-11-01', '2026-11-20', '2026-11-19')).toBe('future');
    expect(checkPeriod('2026-11-01', 'nope', '2026-11-19')).toBe('invalid');
  });
});
