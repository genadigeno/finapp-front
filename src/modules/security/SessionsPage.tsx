// Your signed-in devices (P18-TSK-010, -032; blueprint §6 security centre): every session finapp holds for the
// customer, the one in use marked, and a way to end any other - or all the others at once. finapp has no single
// door for "all the others", so the page ends each one in turn (DELETE /v1/sessions/{id}); one finapp no longer
// knows (404) is already gone. Ending this one is "Sign out".
import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { formatInstant } from '../../design-system/dates.ts';
import { ApiError } from '../../platform/api/api-error.ts';
import { ok } from '../../platform/api/client.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { useCommand } from '../../platform/api/use-command.ts';

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
});

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
  assurance: string | undefined;
}

export function SessionsPage() {
  const intl = useIntl();
  const api = useApi();
  const sessions = useQuery({
    queryKey: SESSIONS_QUERY,
    queryFn: async (): Promise<SessionRow[]> => {
      const { data } = await ok(api.GET('/v1/sessions'));
      return data.flatMap((s) =>
        s.id === undefined
          ? []
          : [{ id: s.id, device: s.device, current: s.current === true, issuedAt: s.issuedAt, assurance: s.assurance }],
      );
    },
  });
  const [confirming, setConfirming] = useState<string | undefined>();
  const [confirmingOthers, setConfirmingOthers] = useState(false);
  const revokeOthers = useCommand(
    async (intent: { body: { ids: readonly string[] } }) => {
      let last: { data: undefined; correlationId: string | undefined } = { data: undefined, correlationId: undefined };
      for (const id of intent.body.ids) {
        try {
          last = await ok(api.DELETE('/v1/sessions/{id}', { params: { path: { id } } }));
        } catch (error) {
          // Already ended (here or elsewhere): nothing left to do for this one.
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
      }
      return last;
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
      {revokeOthers.state.status === 'succeeded' && others.length === 0 ? (
        <Text role="status">
          <FormattedMessage {...messages.othersDone} />
        </Text>
      ) : null}
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
                  <Badge variant="light" color="blue">
                    <FormattedMessage {...messages.thisDevice} />
                  </Badge>
                ) : null}
              </Group>
              {session.issuedAt === undefined ? null : (
                <Text size="sm" c="dimmed">
                  {intl.formatMessage(signedInMessage, { when: instantText(session.issuedAt, intl.locale) })}
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
