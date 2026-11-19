// A command screen's state, over executeCommand (ADR-F05). One hook for every command a customer sends:
//   - `prepare(body)` freezes the reviewed request in an IdempotencyIntent (on reaching review);
//   - `send()` runs it - step-up, same-key re-sends and the unknown outcome all handled by the runner;
//   - after a definite success, the named query roots are re-read here and in every other tab;
//   - `resendSame()` sends the SAME intent again (the unknown-outcome screen's choice) - never a new key.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { invalidateRoots } from '../query/query-client.ts';
import { broadcastInvalidation } from '../session/cross-tab.ts';
import { useStepUp } from '../session/step-up-context.ts';
import { track } from '../telemetry/telemetry.ts';
import type { ApiSuccess } from './client.ts';
import { executeCommand, type CommandResult } from './command.ts';
import { IdempotencyIntent } from './idempotency.ts';

export type CommandState<D> = { status: 'idle' } | { status: 'sending' } | CommandResult<D>;

export interface UseCommandOptions {
  /** Query roots to re-read after success, here and in other tabs. */
  invalidate?: readonly string[];
  /** The static route id, for the outcome telemetry. */
  routeId?: string;
}

export function useCommand<Body, D>(
  send: (intent: IdempotencyIntent<Body>) => Promise<ApiSuccess<D>>,
  options: UseCommandOptions = {},
) {
  const requestStepUp = useStepUp();
  const queryClient = useQueryClient();
  const [state, setState] = useState<CommandState<D>>({ status: 'idle' });
  const intent = useRef<IdempotencyIntent<Body> | undefined>(undefined);
  const inFlight = useRef(false);

  const prepare = useCallback((body: Body) => {
    intent.current = IdempotencyIntent.forReview(body);
    setState({ status: 'idle' });
  }, []);

  const discard = useCallback(() => {
    intent.current = undefined;
    setState({ status: 'idle' });
  }, []);

  const run = useCallback(async (): Promise<CommandResult<D> | undefined> => {
    const current = intent.current;
    if (current === undefined || inFlight.current) return undefined;
    inFlight.current = true;
    setState({ status: 'sending' });
    try {
      const result = await executeCommand(current, send, { requestStepUp });
      // An intent outlives its send only while its outcome is unknown: that is the one case where the SAME
      // request must be sent again (resendSame). A definite outcome ends it.
      if (result.status !== 'unknown') intent.current = undefined;
      setState(result);
      track('command.outcome', {
        routeId: options.routeId,
        outcome: result.status,
        code: result.status === 'succeeded' ? undefined : result.error.code,
        correlationId: result.status === 'succeeded' ? result.correlationId : result.error.correlationId,
      });
      if (result.status === 'succeeded' && options.invalidate !== undefined) {
        await invalidateRoots(queryClient, options.invalidate, broadcastInvalidation);
      }
      return result;
    } finally {
      inFlight.current = false;
    }
  }, [send, requestStepUp, queryClient, options.invalidate, options.routeId]);

  /**
   * Prepares and sends in one step - for commands with no separate review screen. The same request after an
   * unknown outcome keeps its key; any other request gets a new one.
   */
  const submit = useCallback(
    async (body: Body) => {
      const pending = intent.current;
      if (pending === undefined || JSON.stringify(pending.body) !== JSON.stringify(body)) {
        intent.current = IdempotencyIntent.forReview(body);
      }
      return run();
    },
    [run],
  );

  return { state, prepare, discard, send: run, resendSame: run, submit };
}

/** The failure a command screen shows: a refusal or an unknown outcome; nothing otherwise. */
export function failureOf<D>(
  state: CommandState<D>,
): (CommandResult<D> & { status: 'refused' | 'unknown' }) | undefined {
  return state.status === 'refused' || state.status === 'unknown' ? state : undefined;
}
