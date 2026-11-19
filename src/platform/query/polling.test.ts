import { describe, expect, it } from 'vitest';
import { backoffMs, pollUntil } from './polling.ts';

describe('polling an asynchronous outcome (ADR-F05 decision 6)', () => {
  it('backs off 2, 4, 8, 15, then every 30 seconds', () => {
    expect([0, 1, 2, 3, 4, 5, 50].map(backoffMs)).toEqual([2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000]);
  });

  it('stops at a terminal status and never before', () => {
    const interval = pollUntil<{ status: string }>((d) => d.status === 'COMPLETED');
    expect(interval({ state: { data: undefined, dataUpdateCount: 0 } })).toBe(2_000);
    expect(interval({ state: { data: { status: 'DISPATCHED' }, dataUpdateCount: 3 } })).toBe(15_000);
    expect(interval({ state: { data: { status: 'COMPLETED' }, dataUpdateCount: 3 } })).toBe(false);
  });
});
