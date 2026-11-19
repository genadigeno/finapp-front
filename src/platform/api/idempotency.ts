// One idempotency intent per review screen (ADR-F05 decision 1; finapp API_CONVENTIONS.md §6).
// Adapted from finapp-admin-panel/src/platform/api/idempotency.ts (ADR-F08).
//
// The key is minted when the customer reaches REVIEW, and the request body is frozen with it:
//   - every send of that review - a double click, a retry after a timeout, the replay after a step-up,
//     the re-send after `api.IdempotencyInProgress` - carries the SAME key and the SAME body, so finapp
//     returns the original outcome and never moves money twice;
//   - editing the form discards the intent; the next review mints a new one;
//   - a new key is NEVER minted to "try again" after an unknown outcome. That is how a second financial
//     effect happens.
// The intent lives in memory only (ADR-F07): a closed tab loses it, and the customer is sent to the
// operation's list to see what happened.

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** finapp's bound (IdempotencyKey.MAX_LENGTH) and its default-deny charset. */
const KEY_PATTERN = /^[A-Za-z0-9._:@/+=-]{1,200}$/;

export class IdempotencyIntent<Body = unknown> {
  readonly key: string;
  /** The request body as reviewed. Frozen: a send can only ever carry exactly this. */
  readonly body: Readonly<Body>;

  private constructor(key: string, body: Body) {
    if (!KEY_PATTERN.test(key)) throw new Error('An idempotency key must be 1-200 characters of the allowed charset.');
    this.key = key;
    this.body = deepFreeze(body);
  }

  /** A fresh intent for the request under review. The key is a random UUID, the shape finapp expects. */
  static forReview<Body>(body: Body, generate: () => string = () => crypto.randomUUID()): IdempotencyIntent<Body> {
    return new IdempotencyIntent(generate(), structuredClone(body));
  }

  /** The header to send with every attempt of this intent. */
  headers(): Record<typeof IDEMPOTENCY_HEADER, string> {
    return { [IDEMPOTENCY_HEADER]: this.key };
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
