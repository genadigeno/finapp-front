// Send abroad (P18-TSK-026; blueprint §4.4): where the customer can send (finapp's corridors, with their fee and
// delivery estimate), their overseas recipients, and the payment journey to a recipient finapp has cleared.
//
// Adding an overseas recipient is not offered: finapp takes the recipient's bank details only through a payment
// provider's single-use grant, and gives the browser no way to obtain one (G-19). A recipient that is not ready
// says only that - never why (INV-RSK-08).
import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Money, StatusChip } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { useCorridors, useRecipients, XB_ROOT, type Corridor, type Recipient } from './api.ts';
import { countryName, deliveryEstimate, entityName, fractionToPercent, RECIPIENT_STATUS } from './labels.ts';

const messages = defineMessages({
  title: { id: 'xb.title', defaultMessage: 'Send abroad' },
  corridors: { id: 'xb.corridors', defaultMessage: 'Where you can send' },
  noCorridors: { id: 'xb.noCorridors', defaultMessage: 'Sending abroad is not available right now' },
  recipients: { id: 'xb.recipients', defaultMessage: 'Your overseas recipients' },
  noRecipients: { id: 'xb.noRecipients', defaultMessage: 'No overseas recipients yet' },
  cannotAdd: {
    id: 'xb.cannotAdd',
    defaultMessage:
      'Adding an overseas recipient is not available here yet. Recipients you already have are listed below.',
  },
  truncated: { id: 'xb.truncated', defaultMessage: 'Showing your 100 most recent recipients.' },
  send: { id: 'xb.send', defaultMessage: 'Send' },
  remove: { id: 'xb.remove', defaultMessage: 'Remove' },
  removeTitle: { id: 'xb.remove.title', defaultMessage: 'Remove this recipient?' },
  removeBody: {
    id: 'xb.remove.body',
    defaultMessage:
      'You will not be able to pay them again unless they are added again. Payments already sent are not affected.',
  },
  back: { id: 'xb.back', defaultMessage: 'Back to Move money' },
});

const corridorMessage = defineMessage<{ source: string; destination: string; country: string }>({
  id: 'xb.corridor',
  defaultMessage: '{source} to {destination} in {country}',
});
const feeMessage = defineMessage<{ percent: string }>({
  id: 'xb.fee',
  defaultMessage: 'Fee: {percent}% of the amount, plus',
});
const maxMessage = defineMessage<{ amount: string }>({ id: 'xb.max', defaultMessage: 'Up to {amount} per payment' });
const daysMessage = defineMessage<{ days: number }>({
  id: 'xb.days',
  defaultMessage: 'Usually arrives within {days, plural, one {# day} other {# days}}',
});
const hoursMessage = defineMessage<{ hours: number }>({
  id: 'xb.hours',
  defaultMessage: 'Usually arrives within {hours, plural, one {# hour} other {# hours}}',
});
const suffixMessage = defineMessage<{ suffix: string }>({ id: 'xb.suffix', defaultMessage: 'account ending {suffix}' });

export function EstimateText({ hours }: { hours: number | undefined }) {
  const intl = useIntl();
  const estimate = deliveryEstimate(hours);
  if (estimate === undefined) return null;
  return (
    <Text size="sm" c="dimmed">
      {'days' in estimate
        ? intl.formatMessage(daysMessage, { days: estimate.days })
        : intl.formatMessage(hoursMessage, { hours: estimate.hours })}
    </Text>
  );
}

function CorridorCard({ corridor }: { corridor: Corridor }) {
  const intl = useIntl();
  const percent = corridor.feeMargin === undefined ? undefined : fractionToPercent(corridor.feeMargin);
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={4}>
        <Text fw={600}>
          {intl.formatMessage(corridorMessage, {
            source: corridor.source,
            destination: corridor.destination,
            country: countryName(corridor.country, intl.locale),
          })}
        </Text>
        {percent === undefined || corridor.feeFixed === undefined ? null : (
          <Text size="sm">
            {intl.formatMessage(feeMessage, { percent })}{' '}
            <Money amount={corridor.feeFixed} currency={corridor.source} />
          </Text>
        )}
        {corridor.maximum === undefined ? null : (
          <Text size="sm" c="dimmed">
            {intl.formatMessage(maxMessage, {
              amount: `${corridor.maximum} ${corridor.destination}`,
            })}
          </Text>
        )}
        <EstimateText hours={corridor.deliveryEstimateHours} />
      </Stack>
    </Card>
  );
}

function RecipientCard({ recipient }: { recipient: Recipient }) {
  const intl = useIntl();
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const revoke = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) =>
      ok(
        api.POST('/v1/me/cross-border/beneficiaries/{id}/revocation', {
          params: { path: { id: intent.body.id }, header: intent.headers() },
        }),
      ),
    { invalidate: [XB_ROOT], routeId: '/send-abroad' },
  );
  const failure = failureOf(revoke.state);
  const entity = entityName(recipient.entityType);
  const payable = recipient.status === 'ACTIVE';
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap" align="flex-start">
          <Stack gap={2}>
            <Group gap="xs">
              <Text fw={600}>{recipient.nickname}</Text>
              {recipient.status === undefined ? null : <StatusChip value={recipient.status} map={RECIPIENT_STATUS} />}
            </Group>
            <Text size="sm" c="dimmed">
              {[
                entity === undefined ? undefined : intl.formatMessage(entity),
                countryName(recipient.country, intl.locale),
                recipient.currency,
                recipient.suffix === undefined
                  ? undefined
                  : intl.formatMessage(suffixMessage, { suffix: recipient.suffix }),
              ]
                .filter((part) => part !== undefined && part !== '')
                .join(' · ')}
            </Text>
          </Stack>
          {recipient.status === 'REVOKED' ? null : (
            <Group gap="xs">
              {payable ? (
                <Button
                  variant="light"
                  renderRoot={(props) => <Link {...props} to="/send-abroad/send" search={{ to: recipient.id }} />}
                >
                  <FormattedMessage {...messages.send} />
                </Button>
              ) : null}
              <Button variant="subtle" color="red" onClick={() => setConfirming(true)}>
                <FormattedMessage {...messages.remove} />
              </Button>
            </Group>
          )}
        </Group>
        {failure === undefined ? null : <ErrorExplained error={failure.error} />}
      </Stack>
      <ConfirmDangerous
        opened={confirming}
        title={intl.formatMessage(messages.removeTitle)}
        confirmLabel={intl.formatMessage(messages.remove)}
        busy={revoke.state.status === 'sending'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void revoke.submit({ id: recipient.id }).finally(() => setConfirming(false))}
      >
        <Text>
          <FormattedMessage {...messages.removeBody} />
        </Text>
      </ConfirmDangerous>
    </Card>
  );
}

export function SendAbroadPage() {
  const intl = useIntl();
  const corridors = useCorridors();
  const recipients = useRecipients();
  return (
    <Stack gap="lg">
      <Link to="/move">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Title order={2}>
        <FormattedMessage {...messages.recipients} />
      </Title>
      <Alert variant="light" color="gray">
        <FormattedMessage {...messages.cannotAdd} />
      </Alert>
      {recipients.isPending ? (
        <LoadingState />
      ) : recipients.isError ? (
        <ErrorExplained error={recipients.error} onRetry={() => void recipients.refetch()} />
      ) : recipients.data.recipients.length === 0 ? (
        <EmptyState title={intl.formatMessage(messages.noRecipients)} />
      ) : (
        <>
          {recipients.data.recipients.map((recipient) => (
            <RecipientCard key={recipient.id} recipient={recipient} />
          ))}
          {recipients.data.truncated ? (
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.truncated} />
            </Text>
          ) : null}
        </>
      )}
      <Title order={2}>
        <FormattedMessage {...messages.corridors} />
      </Title>
      {corridors.isPending ? (
        <LoadingState />
      ) : corridors.isError ? (
        <ErrorExplained error={corridors.error} onRetry={() => void corridors.refetch()} />
      ) : corridors.data.length === 0 ? (
        <EmptyState title={intl.formatMessage(messages.noCorridors)} />
      ) : (
        corridors.data.map((corridor) => <CorridorCard key={corridor.code} corridor={corridor} />)
      )}
    </Stack>
  );
}
