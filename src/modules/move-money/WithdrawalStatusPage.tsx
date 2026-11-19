// A withdrawal's progress (P18-TSK-024, -027): follows finapp until it completes or fails. A withdrawal finapp is
// still confirming with the bank, or holding, reads as "processing" - no reason, no deadline, no hint of review
// (INV-RSK-08). Never shows success finapp has not reported.
import { Card, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { WITHDRAWAL_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, Money, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { pollUntil } from '../../platform/query/polling.ts';
import { withdrawalFailure } from './labels.ts';

const messages = defineMessages({
  title: { id: 'withdrawalStatus.title', defaultMessage: 'Your withdrawal' },
  inProgress: {
    id: 'withdrawalStatus.inProgress',
    defaultMessage:
      'Your money is on its way to your bank. This page updates by itself; you can leave and come back. Please do not withdraw it again.',
  },
  completed: { id: 'withdrawalStatus.completed', defaultMessage: 'Your bank has the money.' },
  started: { id: 'withdrawalStatus.started', defaultMessage: 'Started' },
  back: { id: 'withdrawalStatus.back', defaultMessage: 'Back to Move money' },
});

const TERMINAL = new Set(['COMPLETED', 'FAILED']);

export function WithdrawalStatusPage() {
  const intl = useIntl();
  const api = useApi();
  const { withdrawalId } = useParams({ strict: false }) as { withdrawalId: string };
  const withdrawal = useQuery({
    queryKey: [ACCOUNTS_ROOT, 'withdrawal', withdrawalId],
    queryFn: async () => ok(api.GET('/v1/me/withdrawals/{id}', { params: { path: { id: withdrawalId } } })),
    refetchInterval: pollUntil((answer: { data: { status?: string } }) => TERMINAL.has(answer.data.status ?? '')),
  });
  if (withdrawal.isPending) return <LoadingState />;
  if (withdrawal.isError) return <ErrorExplained error={withdrawal.error} onRetry={() => void withdrawal.refetch()} />;
  const view = withdrawal.data.data;
  const status = view.status ?? 'UNKNOWN';
  return (
    <Stack gap="lg" maw={560}>
      <Link to="/move">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          {view.amount === undefined || view.currency === undefined ? null : (
            <Money amount={view.amount} currency={view.currency} size="lg" />
          )}
          <StatusChip value={status} map={WITHDRAWAL_STATUS} />
          {view.createdAt === undefined ? null : (
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.started} />: <Timestamp value={view.createdAt} withZone />
            </Text>
          )}
          <CorrelationReference correlationId={withdrawal.data.correlationId} />
        </Stack>
      </Card>
      <Text>
        {status === 'COMPLETED' ? (
          <FormattedMessage {...messages.completed} />
        ) : status === 'FAILED' ? (
          intl.formatMessage(withdrawalFailure(view.failureReason))
        ) : (
          <FormattedMessage {...messages.inProgress} />
        )}
      </Text>
    </Stack>
  );
}
