import { afterEach, describe, expect, it } from 'vitest';
import { sanitise, setTelemetryTransport, track, type TelemetryEvent } from './telemetry.ts';

// DOD-CUST: no token, amount or personal data is reachable by telemetry - proved with a spy transport
// (blueprint §22 item 8).

afterEach(() => setTelemetryTransport(undefined));

function spy() {
  const events: TelemetryEvent[] = [];
  setTelemetryTransport((event) => events.push(event));
  return events;
}

const SECRETS = {
  token: 'tok_7c1f0c5e9b2a4d3f',
  sessionToken: 'tok_7c1f0c5e9b2a4d3f',
  amount: '1250.00',
  iban: 'DE89370400440532013000',
  email: 'someone@example.com',
  name: 'Jane Customer',
  password: 'hunter2',
};

describe('telemetry by allow-list (ADR-F07 decision 5)', () => {
  it('passes only the schema fields, each matching its pattern', () => {
    const events = spy();
    track('api.failure', {
      routeId: '/v1/me/accounts/{id}',
      category: 'stale',
      code: 'fx.QuoteExpired',
      status: '409',
      correlationId: '0190a3c1-1111-7222-8333-444455556666',
      ...SECRETS,
    });
    expect(events).toEqual([
      {
        kind: 'api.failure',
        fields: {
          routeId: '/v1/me/accounts/{id}',
          category: 'stale',
          code: 'fx.QuoteExpired',
          status: '409',
          correlationId: '0190a3c1-1111-7222-8333-444455556666',
        },
      },
    ]);
  });

  it('drops a secret smuggled into an allowed field', () => {
    expect(
      sanitise('api.failure', {
        routeId: '/v1/me/accounts/acc_123?token=tok_7c1f0c5e9b2a4d3f',
        code: 'Jane Customer',
        status: '1250.00',
        correlationId: 'someone@example.com',
      }),
    ).toEqual({});
    expect(sanitise('web.vital', { name: 'LCP', value: '1250.00' })).toEqual({ name: 'LCP' });
  });

  it('drops anything that is not a string - no objects, arrays or numbers ride along', () => {
    expect(sanitise('route.view', { routeId: { toString: () => '/home' } as unknown as string })).toEqual({});
    expect(sanitise('web.vital', { name: 'LCP', value: 1250 as unknown as string })).toEqual({ name: 'LCP' });
  });

  it('no secret value appears anywhere in any event, whatever is passed', () => {
    const events = spy();
    for (const kind of ['route.view', 'api.failure', 'command.outcome', 'web.vital', 'app.defect'] as const) {
      track(kind, { ...SECRETS, routeId: SECRETS.iban, code: SECRETS.email, value: SECRETS.amount });
    }
    const serialised = JSON.stringify(events);
    for (const secret of Object.values(SECRETS)) expect(serialised).not.toContain(secret);
  });

  it('ignores an unknown kind and never throws when the transport does', () => {
    const events = spy();
    track('made.up' as never, { routeId: '/home' });
    expect(events).toEqual([]);
    setTelemetryTransport(() => {
      throw new Error('collector down');
    });
    expect(() => track('route.view', { routeId: '/home' })).not.toThrow();
  });
});
