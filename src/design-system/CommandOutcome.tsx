// What a money-moving command's screen shows after "Confirm" (ADR-F05): a refusal explained, with a way back to
// change the details; an unknown outcome as "we are checking", with the same request offered again under the same
// key; nothing for success (the journey shows its own receipt).
import { Button, Group, Stack } from '@mantine/core';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { ApiError } from '../platform/api/api-error.ts';
import { ErrorExplained, UnknownOutcome } from './States.tsx';

const messages = defineMessages({
  change: { id: 'command.change', defaultMessage: 'Change the details' },
});

export interface CommandOutcomeProps {
  state: { status: 'refused' | 'unknown'; error: ApiError };
  /** Back to the form; the next review mints a new idempotency key. */
  onChange: () => void;
  /** Where the customer checks whether it went through (a list, a status page). */
  onCheck?: () => void;
  /** Sends the SAME request with the SAME key. */
  onSendSame: () => void;
}

export function CommandOutcome({ state, onChange, onCheck, onSendSame }: CommandOutcomeProps) {
  if (state.status === 'unknown') {
    return (
      <UnknownOutcome
        correlationId={state.error.correlationId}
        onSendSame={onSendSame}
        {...(onCheck === undefined ? {} : { onCheck })}
      />
    );
  }
  return (
    <Stack gap="sm">
      <ErrorExplained error={state.error} />
      <Group>
        <Button variant="default" onClick={onChange}>
          <FormattedMessage {...messages.change} />
        </Button>
      </Group>
    </Stack>
  );
}
