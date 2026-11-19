// Running a command - one customer intent, at most one effect (ADR-F05; P18-TSK-003).
//
// A command is sent with its review's IdempotencyIntent. The runner re-sends it ONLY in the cases ADR-F05
// allows, each with the SAME key and the SAME frozen body:
//   1. after `403 identity.AssuranceRequired`, once the customer has stepped up - exactly once;
//   2. after `409 api.IdempotencyInProgress` - the first attempt is still running;
//   3. after a 503 finapp declares not served (`api.Overloaded`, `api.TemporarilyUnavailable`) that
//      carries a Retry-After.
// Cases 2 and 3 are bounded (MAX_RESENDS) and wait as finapp asks (capped). Anything else is final:
//   - a refusal (4xx) is `refused` - nothing was done;
//   - no definite answer (timeout, network, an unexplained 5xx) is `unknown` - it may have been applied.
// `unknown` is never shown as a failure, and never answered with a new key (ADR-F05 decision 3).
import { ApiError } from './api-error.ts';
import type { ApiSuccess } from './client.ts';
import type { IdempotencyIntent } from './idempotency.ts';

export const MAX_RESENDS = 3;
/** The longest single wait the runner accepts; past it, the outcome is handed back to the customer. */
export const MAX_WAIT_SECONDS = 10;
const IN_PROGRESS_WAIT_SECONDS = 1;

export type CommandResult<D> =
  | { status: 'succeeded'; data: D; correlationId: string | undefined }
  | { status: 'refused'; error: ApiError }
  | { status: 'unknown'; error: ApiError };

export interface CommandEnvironment {
  /** Asks the customer to prove a second factor; resolves once the session is stepped up, rejects on cancel. */
  requestStepUp: () => Promise<void>;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sends `intent` through `send` until it has a definite outcome or the rules above stop it. `send` must
 * build the request from `intent.body` and `intent.headers()` alone.
 */
export async function executeCommand<Body, D>(
  intent: IdempotencyIntent<Body>,
  send: (intent: IdempotencyIntent<Body>) => Promise<ApiSuccess<D>>,
  environment: CommandEnvironment,
): Promise<CommandResult<D>> {
  const sleep = environment.sleep ?? defaultSleep;
  let steppedUp = false;
  let resends = 0;
  for (;;) {
    try {
      const { data, correlationId } = await send(intent);
      return { status: 'succeeded', data, correlationId };
    } catch (failure) {
      if (!(failure instanceof ApiError)) throw failure;

      if (failure.isAssuranceRequired && !steppedUp) {
        try {
          await environment.requestStepUp();
        } catch {
          return { status: 'refused', error: failure };
        }
        steppedUp = true;
        continue;
      }

      const wait = resendWaitSeconds(failure);
      if (wait !== undefined && resends < MAX_RESENDS) {
        resends += 1;
        await sleep(wait * 1000);
        continue;
      }

      return failure.commandOutcome === 'unknown'
        ? { status: 'unknown', error: failure }
        : { status: 'refused', error: failure };
    }
  }
}

/** Seconds to wait before re-sending the same request, or undefined when it must not be re-sent. */
function resendWaitSeconds(error: ApiError): number | undefined {
  if (error.isIdempotencyInProgress)
    return Math.min(error.retryAfterSeconds ?? IN_PROGRESS_WAIT_SECONDS, MAX_WAIT_SECONDS);
  if (error.isNotServed && error.retryAfterSeconds !== undefined && error.retryAfterSeconds <= MAX_WAIT_SECONDS) {
    return error.retryAfterSeconds;
  }
  return undefined;
}
