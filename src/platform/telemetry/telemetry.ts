// Telemetry by allow-list (ADR-F07 decision 5; DOD-CUST).
//
// An event names its kind, and each kind admits only the fields its schema lists, each checked against a
// pattern that a token, an amount, a name or an identifier of a customer's record cannot match. Anything
// else is DROPPED before it reaches a transport - not redacted, not hashed: dropped. The schema is the
// contract with whoever reads the telemetry; widening it is a reviewed change to this file.
//
// There is no vendor: the default transport discards everything. A first-party collector, or any paid
// service, needs the owner's approval (blueprint §16).

type FieldRule = RegExp;

/**
 * Static route ids and API route templates (`/v1/me/accounts/{id}`) - never a concrete path, which may
 * carry an identifier.
 */
const ROUTE_ID = /^\/[a-zA-Z0-9/_${}-]{0,120}$/;
/** A problem code: `module.CodeName`. */
const PROBLEM_CODE = /^[a-z]+\.[A-Za-z]{2,60}$/;
/** A correlation reference finapp minted: a UUID. */
const CORRELATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ERROR_CATEGORY =
  /^(validation|unauthenticated|assurance|forbidden|not-found|refused|in-progress|stale|rate-limited|unavailable|unknown-outcome|defect)$/;
const HTTP_STATUS = /^[1-5]\d\d$/;
const VITAL_NAME = /^(LCP|INP|CLS|FCP|TTFB)$/;
/** A rounded measurement: digits only, at most 7 of them, so no amount with a decimal point fits. */
const MEASUREMENT = /^\d{1,7}$/;
const OUTCOME = /^(succeeded|refused|unknown)$/;

export const TELEMETRY_SCHEMA = {
  'route.view': { routeId: ROUTE_ID },
  'api.failure': {
    routeId: ROUTE_ID,
    category: ERROR_CATEGORY,
    code: PROBLEM_CODE,
    status: HTTP_STATUS,
    correlationId: CORRELATION_ID,
  },
  'command.outcome': { routeId: ROUTE_ID, outcome: OUTCOME, code: PROBLEM_CODE, correlationId: CORRELATION_ID },
  'web.vital': { name: VITAL_NAME, value: MEASUREMENT },
  'app.defect': { routeId: ROUTE_ID },
} as const satisfies Record<string, Record<string, FieldRule>>;

export type TelemetryKind = keyof typeof TELEMETRY_SCHEMA;

export interface TelemetryEvent {
  kind: TelemetryKind;
  fields: Readonly<Record<string, string>>;
}

export type TelemetryTransport = (event: TelemetryEvent) => void;

const discard: TelemetryTransport = () => undefined;
let transport: TelemetryTransport = discard;

/** Installs the transport (a first-party collector once approved; a spy in tests). */
export function setTelemetryTransport(next: TelemetryTransport | undefined): void {
  transport = next ?? discard;
}

/**
 * Keeps only the fields the kind's schema lists whose values match their pattern. Values are taken as
 * strings only: a number, an object or an array is dropped, so nothing structured can ride along.
 */
export function sanitise(kind: TelemetryKind, fields: Readonly<Record<string, unknown>>): Record<string, string> {
  const schema: Readonly<Record<string, FieldRule>> = TELEMETRY_SCHEMA[kind];
  const kept: Record<string, string> = {};
  for (const [name, rule] of Object.entries(schema)) {
    const value = fields[name];
    if (typeof value === 'string' && rule.test(value)) kept[name] = value;
  }
  return kept;
}

export function track(kind: TelemetryKind, fields: Readonly<Record<string, unknown>> = {}): void {
  if (!Object.hasOwn(TELEMETRY_SCHEMA, kind)) return;
  try {
    transport({ kind, fields: sanitise(kind, fields) });
  } catch {
    // Telemetry never breaks the application.
  }
}
