// Your details (P18-TSK-034; blueprint §6 profile): what finapp holds about the customer - their name, the name
// they sign in with, the kind of customer and since when, and their customer reference - and the one detail finapp
// lets them change, their name (PATCH /v1/me). Personal data beyond the name is not captured by finapp (G-07), and
// contact addresses cannot be verified because nothing delivers the code (G-03): neither is offered.
import { Anchor, Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Timestamp } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { useStanding } from '../../platform/session/standing.ts';

/** finapp's limit on a name's length. */
const NAME_MAX = 200;
/** Characters finapp refuses in a name: control, format, surrogate, private-use and unassigned code points. */
const REFUSED = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u;

const messages = defineMessages({
  title: { id: 'profile.title', defaultMessage: 'Your details' },
  name: { id: 'profile.name', defaultMessage: 'Name' },
  businessName: { id: 'profile.businessName', defaultMessage: 'Business name' },
  change: { id: 'profile.change', defaultMessage: 'Change' },
  save: { id: 'profile.save', defaultMessage: 'Save' },
  cancel: { id: 'profile.cancel', defaultMessage: 'Cancel' },
  saved: { id: 'profile.saved', defaultMessage: 'Your name is changed.' },
  needName: { id: 'profile.needName', defaultMessage: 'Enter a name.' },
  nameTooLong: { id: 'profile.nameTooLong', defaultMessage: 'Use at most 200 characters.' },
  nameCharacters: {
    id: 'profile.nameCharacters',
    defaultMessage: 'Use letters, numbers, spaces and punctuation only.',
  },
  signIn: { id: 'profile.signIn', defaultMessage: 'You sign in as' },
  kind: { id: 'profile.kind', defaultMessage: 'Customer type' },
  person: { id: 'profile.person', defaultMessage: 'Personal' },
  organisation: { id: 'profile.organisation', defaultMessage: 'Business' },
  since: { id: 'profile.since', defaultMessage: 'Customer since' },
  reference: { id: 'profile.reference', defaultMessage: 'Customer reference' },
  consents: { id: 'profile.consents', defaultMessage: 'Your consents' },
  consentsBody: {
    id: 'profile.consentsBody',
    defaultMessage: 'See what you have agreed we may do with your data, and change it.',
  },
  notYet: {
    id: 'profile.notYet',
    defaultMessage:
      'Adding an email address or phone number, and changing other personal details, is not available here yet.',
  },
});

export function ProfilePage() {
  const intl = useIntl();
  const api = useApi();
  const standing = useStanding();
  const [editing, setEditing] = useState(false);
  const [nameText, setNameText] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const rename = useCommand(
    async (intent: IdempotencyIntent<{ displayName: string }>) => ok(api.PATCH('/v1/me', { body: { ...intent.body } })),
    { invalidate: ['me'], routeId: '/profile' },
  );

  if (standing.isPending) return <LoadingState />;
  if (standing.isError) return <ErrorExplained error={standing.error} onRetry={() => void standing.refetch()} />;
  const { displayName, partyKind, partyId, loginIdentifier, registeredAt } = standing.data;
  const failure = failureOf(rename.state);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const name = nameText.trim();
    const next =
      name === ''
        ? messages.needName
        : name.length > NAME_MAX
          ? messages.nameTooLong
          : REFUSED.test(name)
            ? messages.nameCharacters
            : undefined;
    setProblem(next === undefined ? undefined : intl.formatMessage(next));
    if (next !== undefined) return;
    const result = await rename.submit({ displayName: name });
    if (result?.status === 'succeeded') setEditing(false);
  };

  const nameLabel = intl.formatMessage(partyKind === 'ORGANISATION' ? messages.businessName : messages.name);

  return (
    <Stack gap="lg" maw={640}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          {editing ? (
            <form onSubmit={(event) => void save(event)} noValidate>
              <Stack gap="sm">
                <TextInput
                  label={nameLabel}
                  value={nameText}
                  onChange={(event) => setNameText(event.currentTarget.value)}
                  error={problem}
                  maxLength={NAME_MAX}
                  autoComplete={partyKind === 'ORGANISATION' ? 'organization' : 'name'}
                />
                {failure === undefined ? null : <ErrorExplained error={failure.error} />}
                <Group>
                  <Button type="submit" loading={rename.state.status === 'sending'}>
                    <FormattedMessage {...messages.save} />
                  </Button>
                  <Button variant="default" onClick={() => setEditing(false)}>
                    <FormattedMessage {...messages.cancel} />
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  {nameLabel}
                </Text>
                <Text fw={600}>{displayName ?? ''}</Text>
              </Stack>
              <Button
                variant="default"
                onClick={() => {
                  setNameText(displayName ?? '');
                  setProblem(undefined);
                  rename.discard();
                  setEditing(true);
                }}
              >
                <FormattedMessage {...messages.change} />
              </Button>
            </Group>
          )}
          {!editing && rename.state.status === 'succeeded' ? (
            <Text size="sm" role="status">
              <FormattedMessage {...messages.saved} />
            </Text>
          ) : null}
          <dl className="finapp-review">
            {loginIdentifier === undefined ? null : (
              <div className="finapp-review__row">
                <dt>{intl.formatMessage(messages.signIn)}</dt>
                <dd>{loginIdentifier}</dd>
              </div>
            )}
            {partyKind === 'UNKNOWN' ? null : (
              <div className="finapp-review__row">
                <dt>{intl.formatMessage(messages.kind)}</dt>
                <dd>{intl.formatMessage(partyKind === 'ORGANISATION' ? messages.organisation : messages.person)}</dd>
              </div>
            )}
            {registeredAt === undefined ? null : (
              <div className="finapp-review__row">
                <dt>{intl.formatMessage(messages.since)}</dt>
                <dd>
                  <Timestamp value={registeredAt} />
                </dd>
              </div>
            )}
            {partyId === undefined ? null : (
              <div className="finapp-review__row">
                <dt>{intl.formatMessage(messages.reference)}</dt>
                <dd className="finapp-mono">{partyId}</dd>
              </div>
            )}
          </dl>
        </Stack>
      </Card>
      <Stack gap={4}>
        <Anchor renderRoot={(props) => <Link {...props} to="/onboarding/consents" />} fw={600}>
          <FormattedMessage {...messages.consents} />
        </Anchor>
        <Text size="sm" c="dimmed">
          <FormattedMessage {...messages.consentsBody} />
        </Text>
      </Stack>
      <Text size="sm" c="dimmed">
        <FormattedMessage {...messages.notYet} />
      </Text>
    </Stack>
  );
}
