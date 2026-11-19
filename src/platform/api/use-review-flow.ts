// The details -> review -> outcome flow of every money-moving journey (ADR-F05; blueprint §4.3):
//   - `review(body)` freezes the request in a new idempotency intent (one per review screen);
//   - `back()` returns to the details and discards the intent - an edited request gets a new key;
//   - `confirm()` sends the frozen request; after an unknown outcome `confirm()` again re-sends the SAME one.
import { useCallback, useState } from 'react';
import type { ApiSuccess } from './client.ts';
import type { IdempotencyIntent } from './idempotency.ts';
import { useCommand, type UseCommandOptions } from './use-command.ts';

export type FlowStep = 'details' | 'review' | 'outcome';

export function useReviewFlow<Body, D>(
  send: (intent: IdempotencyIntent<Body>) => Promise<ApiSuccess<D>>,
  options: UseCommandOptions = {},
) {
  const command = useCommand(send, options);
  const [step, setStep] = useState<FlowStep>('details');
  const [body, setBody] = useState<Body | undefined>();
  const { prepare, discard, send: sendIntent } = command;

  const review = useCallback(
    (next: Body) => {
      prepare(next);
      setBody(next);
      setStep('review');
    },
    [prepare],
  );

  const back = useCallback(() => {
    discard();
    setStep('details');
  }, [discard]);

  const confirm = useCallback(async () => {
    setStep('outcome');
    return sendIntent();
  }, [sendIntent]);

  return { step, body, review, back, confirm, state: command.state };
}
