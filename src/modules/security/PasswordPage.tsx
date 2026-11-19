// Change your password (P18-TSK-033; POST /v1/me/credential). The current password is the proof; a customer with
// two-step verification is asked for a code first (step-up). finapp rotates this session - the new token replaces
// the old one at once (acceptIssuedSession) - and signs out every other device. Its only rule is the length, 8 to
// 256 characters. A wrong current password and a temporarily locked account get the same answer, as at sign-in.
//
// The passwords live in this page's memory only, for the one request, and are cleared once it is answered. The
// new session token never reaches React state or telemetry.
import { Button, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained } from '../../design-system/States.tsx';
import { ResultPanel } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok, type ApiSuccess } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { acceptIssuedSession } from '../../platform/session/session-store.ts';

/** finapp's only password rule (RawPassword): its length. */
const MIN = 8;
const MAX = 256;

const messages = defineMessages({
  title: { id: 'password.title', defaultMessage: 'Change your password' },
  lead: {
    id: 'password.lead',
    defaultMessage: 'Changing it signs you out on every other device. You stay signed in here.',
  },
  current: { id: 'password.current', defaultMessage: 'Current password' },
  next: { id: 'password.new', defaultMessage: 'New password' },
  nextHint: {
    id: 'password.new.hint',
    defaultMessage: 'Between 8 and 256 characters. A long phrase you do not use anywhere else is best.',
  },
  repeat: { id: 'password.repeat', defaultMessage: 'Repeat the new password' },
  needCurrent: { id: 'password.needCurrent', defaultMessage: 'Enter your current password.' },
  length: { id: 'password.length', defaultMessage: 'Use between 8 and 256 characters.' },
  mismatch: { id: 'password.mismatch', defaultMessage: 'The two new passwords are not the same.' },
  submit: { id: 'password.submit', defaultMessage: 'Change password' },
  refusedTitle: { id: 'password.refused.title', defaultMessage: 'Your password was not changed' },
  refusedBody: {
    id: 'password.refused.body',
    defaultMessage:
      'The current password is not right, or there were too many attempts and your account is locked for 15 minutes.',
  },
  done: { id: 'password.done', defaultMessage: 'Your password is changed' },
  doneBody: {
    id: 'password.done.body',
    defaultMessage: 'Every other device is signed out. Use the new password next time you sign in.',
  },
  back: { id: 'password.back', defaultMessage: 'Back to Security' },
});

interface Change {
  currentPassword: string;
  newPassword: string;
}

export function PasswordPage() {
  const intl = useIntl();
  const api = useApi();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [problems, setProblems] = useState<{ current?: string; next?: string; repeat?: string }>({});
  const change = useCommand(
    async (intent: IdempotencyIntent<Change>): Promise<ApiSuccess<undefined>> => {
      const { data, correlationId } = await ok(api.POST('/v1/me/credential', { body: { ...intent.body } }));
      // The old token is dead from here: the rotated session is taken up before anything else is sent.
      acceptIssuedSession(data);
      return { data: undefined, correlationId };
    },
    { invalidate: ['sessions'], routeId: '/security/password' },
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: typeof problems = {};
    if (current === '') found.current = intl.formatMessage(messages.needCurrent);
    if (next.length < MIN || next.length > MAX) found.next = intl.formatMessage(messages.length);
    else if (repeat !== next) found.repeat = intl.formatMessage(messages.mismatch);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const body = { currentPassword: current, newPassword: next };
    setCurrent('');
    setNext('');
    setRepeat('');
    await change.submit(body);
  };

  const failure = failureOf(change.state);
  const wrongPassword = failure?.error.code === 'identity.AuthenticationFailed';

  return (
    <Stack gap="lg" maw={480}>
      <Link to="/security">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      {change.state.status === 'succeeded' ? (
        <ResultPanel
          kind="succeeded"
          title={intl.formatMessage(messages.done)}
          correlationId={change.state.correlationId}
        >
          <FormattedMessage {...messages.doneBody} />
        </ResultPanel>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <Stack>
            <Text>
              <FormattedMessage {...messages.lead} />
            </Text>
            {failure === undefined ? null : wrongPassword ? (
              <Stack gap={2} role="alert">
                <Text fw={600}>
                  <FormattedMessage {...messages.refusedTitle} />
                </Text>
                <Text size="sm">
                  <FormattedMessage {...messages.refusedBody} />
                </Text>
              </Stack>
            ) : (
              <ErrorExplained error={failure.error} />
            )}
            <PasswordInput
              label={intl.formatMessage(messages.current)}
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.currentTarget.value)}
              error={problems.current}
            />
            <PasswordInput
              label={intl.formatMessage(messages.next)}
              description={intl.formatMessage(messages.nextHint)}
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.currentTarget.value)}
              error={problems.next}
              maxLength={MAX}
            />
            <PasswordInput
              label={intl.formatMessage(messages.repeat)}
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.currentTarget.value)}
              error={problems.repeat}
              maxLength={MAX}
            />
            <div>
              <Button type="submit" loading={change.state.status === 'sending'}>
                <FormattedMessage {...messages.submit} />
              </Button>
            </div>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
