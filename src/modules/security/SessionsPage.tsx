// Your signed-in devices (P18-TSK-010, -032; blueprint §6 security centre): every session finapp holds for the
// customer, the one in use marked, and a way to end any other - or all the others at once. finapp has no single
// door for "all the others", so the page ends each one in turn (DELETE /v1/sessions/{id}); one finapp no longer
// knows (404) is already gone; a 401 means this session has ended, so the loop stops and never retries. Ending
// this one is "Sign out".
//
// "All other devices are signed out" is said only after a fresh GET /v1/sessions shows this device alone: a
// device can sign in while the loop runs, and then the page says so and offers to go again. A password change
// is the one-step answer to a suspected compromise - it ends every other session at once.
import { Anchor, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { formatInstant } from '../../design-system/dates.ts';
import { ApiError } from '../../platform/api/api-error.ts';
import { ok } from '../../platform/api/client.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { useCommand } from '../../platform/api/use-command.ts';
import type { components } from '../../generated/finapp-api.ts';

export const SESSIONS_QUERY = ['sessions'] as const;

const messages = defineMessages({
  title: { id: 'sessions.title', defaultMessage: 'Signed-in devices' },
  lead: {
    id: 'sessions.lead',
    defaultMessage: 'These are the places your account is signed in. If you do not recognise one, sign it out.',
  },
  thisDevice: { id: 'sessions.thisDevice', defaultMessage: 'This device' },
  unknownDevice: { id: 'sessions.unknownDevice', defaultMessage: 'Unknown device' },
  signOutDevice: { id: 'sessions.signOutDevice', defaultMessage: 'Sign out this device' },
  confirmTitle: { id: 'sessions.confirm.title', defaultMessage: 'Sign out this device?' },
  confirmBody: {
    id: 'sessions.confirm.body',
    defaultMessage: 'Whoever is using it will be signed out at once and must sign in again.',
  },
  empty: { id: 'sessions.empty', defaultMessage: 'No other devices are signed in.' },
  strong: { id: 'sessions.assurance.strong', defaultMessage: 'Confirmed with your authenticator' },
  signOutOthers: { id: 'sessions.signOutOthers', defaultMessage: 'Sign out all other devices' },
  othersTitle: { id: 'sessions.others.title', defaultMessage: 'Sign out all other devices?' },
  othersBody: {
    id: 'sessions.others.body',
    defaultMessage: 'Everyone using your account anywhere else is signed out at once. This device stays signed in.',
  },
  othersDone: { id: 'sessions.others.done', defaultMessage: 'All other devices are signed out.' },
  othersSurvived: {
    id: 'sessions.others.survived',
    defaultMessage: 'A device signed in while we were signing the others out.',
  },
  othersAgain: { id: 'sessions.others.again', defaultMessage: 'Sign out the other devices again' },
  othersUnchecked: {
    id: 'sessions.others.unchecked',
    defaultMessage: 'We signed out the other devices but could not check the list again. Look at the list below.',
  },
  compromise: {
    id: 'sessions.compromise',
    defaultMessage: 'Think someone else has your password? Change it - it signs out every other device in one step.',
  },
  changePassword: { id: 'sessions.compromise.link', defaultMessage: 'Change password' },
});

const idleEndsMessage = defineMessage<{ when: string }>({
  id: 'sessions.idleExpiresAt',
  defaultMessage: 'Ends after inactivity at {when}',
});

const absoluteEndsMessage = defineMessage<{ when: string }>({
  id: 'sessions.absoluteExpiresAt',
  defaultMessage: 'Ends at the latest {when}',
});

/** What the fresh read after "sign out all others" showed. */
type OthersOutcome = 'alone' | 'survivors' | 'unchecked';

const signedInMessage = defineMessage<{ when: string }>({
  id: 'sessions.signedIn',
  defaultMessage: 'Signed in {when}',
});

function instantText(value: string, locale: string): string {
  const formatted = formatInstant(value, locale);
  return formatted.valid ? formatted.text : formatted.raw;
}

interface SessionRow {
  id: string;
  device: string | undefined;
  current: boolean;
  issuedAt: string | undefined;
  idleExpiresAt: string | undefined;
  absoluteExpiresAt: string | undefined;
  assurance: string | undefined;
}

type SessionSummary = components['schemas']['SessionSummary'];

function toRows(data: readonly SessionSummary[]): SessionRow[] {
  return data.flatMap((s) =>
    s.id === undefined
      ? []
      : [
          {
            id: s.id,
            device: s.device,
            current: s.current === true,
            issuedAt: s.issuedAt,
            idleExpiresAt: s.idleExpiresAt,
            absoluteExpiresAt: s.absoluteExpiresAt,
            assurance: s.assurance,
          },
        ],
  );
}

export function SessionsPage() {
  const intl = useIntl();
  const api = useApi();
  const sessions = useQuery({
    queryKey: SESSIONS_QUERY,
    queryFn: async (): Promise<SessionRow[]> => {
      const { data } = await ok(api.GET('/v1/sessions'));
      return toRows(data);
    },
  });
  const [confirming, setConfirming] = useState<string | undefined>();
  const [confirmingOthers, setConfirmingOthers] = useState(false);
  const revokeOthers = useCommand(
    async (intent: { body: { ids: readonly string[] } }) => {
      let correlationId: string | undefined;
      for (const id of intent.body.ids) {
        try {
          correlationId = (await ok(api.DELETE('/v1/sessions/{id}', { params: { path: { id } } }))).correlationId;
        } catch (error) {
          // Already ended (here or elsewhere): nothing left to do for this one. Anything else - a 401 above all,
          // which means this session has ended - stops the loop; it is never retried from here.
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
      }
      // Only a fresh read can say whether the others are really gone.
      let outcome: OthersOutcome;
      try {
        const { data } = await ok(api.GET('/v1/sessions'));
        outcome = toRows(data).every((row) => row.current) ? 'alone' : 'survivors';
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error;
        outcome = 'unchecked';
      }
      return { data: outcome, correlationId };
    },
    { invalidate: ['sessions'], routeId: '/security/devices' },
  );
  const revoke = useCommand(
    async (intent: { body: { id: string } }) =>
      ok(api.DELETE('/v1/sessions/{id}', { params: { path: { id: intent.body.id } } })),
    { invalidate: ['sessions'], routeId: '/security/devices' },
  );

  if (sessions.isPending) return <LoadingState />;
  if (sessions.isError) return <ErrorExplained error={sessions.error} onRetry={() => void sessions.refetch()} />;

  const rows = [...sessions.data].sort((a, b) => Number(b.current) - Number(a.current));
  const others = rows.filter((row) => !row.current).map((row) => row.id);
  return (
    <Stack gap="lg">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text>
        <FormattedMessage {...messages.lead} />
      </Text>
      {revoke.state.status === 'refused' || revoke.state.status === 'unknown' ? (
        <ErrorExplained error={revoke.state.error} />
      ) : null}
      {revokeOthers.state.status === 'refused' || revokeOthers.state.status === 'unknown' ? (
        <ErrorExplained error={revokeOthers.state.error} />
      ) : null}
      {revokeOthers.state.status === 'succeeded' && revokeOthers.state.data === 'alone' && others.length === 0 ? (
        <Text role="status">
          <FormattedMessage {...messages.othersDone} />
        </Text>
      ) : null}
      {revokeOthers.state.status === 'succeeded' &&
      (revokeOthers.state.data === 'survivors' || (revokeOthers.state.data === 'alone' && others.length > 0)) ? (
        <Stack gap="xs" role="status">
          <Text>
            <FormattedMessage {...messages.othersSurvived} />
          </Text>
          {others.length > 0 ? (
            <div>
              <Button variant="default" onClick={() => setConfirmingOthers(true)}>
                <FormattedMessage {...messages.othersAgain} />
              </Button>
            </div>
          ) : null}
        </Stack>
      ) : null}
      {revokeOthers.state.status === 'succeeded' && revokeOthers.state.data === 'unchecked' ? (
        <Text role="status">
          <FormattedMessage {...messages.othersUnchecked} />
        </Text>
      ) : null}
      <Text size="sm">
        <FormattedMessage {...messages.compromise} />{' '}
        <Anchor component={Link} to="/security/password">
          <FormattedMessage {...messages.changePassword} />
        </Anchor>
      </Text>
      {rows.length <= 1 ? (
        <Text c="dimmed">
          <FormattedMessage {...messages.empty} />
        </Text>
      ) : (
        <div>
          <Button variant="default" onClick={() => setConfirmingOthers(true)}>
            <FormattedMessage {...messages.signOutOthers} />
          </Button>
        </div>
      )}
      {rows.map((session) => (
        <Card key={session.id} withBorder radius="md" padding="md">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={2}>
              <Group gap="xs">
                <Text fw={600}>{session.device ?? intl.formatMessage(messages.unknownDevice)}</Text>
                {session.current ? (
                  <Badge variant="light" color="navy">
                    <FormattedMessage {...messages.thisDevice} />
                  </Badge>
                ) : null}
              </Group>
              {session.issuedAt === undefined ? null : (
                <Text size="sm" c="dimmed">
                  {intl.formatMessage(signedInMessage, { when: instantText(session.issuedAt, intl.locale) })}
                </Text>
              )}
              {session.idleExpiresAt === undefined ? null : (
                <Text size="sm" c="dimmed">
                  {intl.formatMessage(idleEndsMessage, { when: instantText(session.idleExpiresAt, intl.locale) })}
                </Text>
              )}
              {session.absoluteExpiresAt === undefined ? null : (
                <Text size="sm" c="dimmed">
                  {intl.formatMessage(absoluteEndsMessage, {
                    when: instantText(session.absoluteExpiresAt, intl.locale),
                  })}
                </Text>
              )}
              {session.assurance === 'MULTI_FACTOR' || session.assurance === 'STRONG' ? (
                <Text size="sm" c="dimmed">
                  <FormattedMessage {...messages.strong} />
                </Text>
              ) : null}
            </Stack>
            {session.current ? null : (
              <Button variant="default" onClick={() => setConfirming(session.id)}>
                <FormattedMessage {...messages.signOutDevice} />
              </Button>
            )}
          </Group>
        </Card>
      ))}
      <ConfirmDangerous
        opened={confirmingOthers}
        title={intl.formatMessage(messages.othersTitle)}
        confirmLabel={intl.formatMessage(messages.signOutOthers)}
        busy={revokeOthers.state.status === 'sending'}
        onCancel={() => setConfirmingOthers(false)}
        onConfirm={() => {
          void revokeOthers.submit({ ids: others }).finally(() => {
            setConfirmingOthers(false);
            void sessions.refetch();
          });
        }}
      >
        <Text>
          <FormattedMessage {...messages.othersBody} />
        </Text>
      </ConfirmDangerous>
      <ConfirmDangerous
        opened={confirming !== undefined}
        title={intl.formatMessage(messages.confirmTitle)}
        confirmLabel={intl.formatMessage(messages.signOutDevice)}
        busy={revoke.state.status === 'sending'}
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => {
          if (confirming === undefined) return;
          void revoke.submit({ id: confirming }).finally(() => setConfirming(undefined));
        }}
      >
        <Text>
          <FormattedMessage {...messages.confirmBody} />
        </Text>
      </ConfirmDangerous>
    </Stack>
  );
}
