// One transfer the customer sent: its receipt, read from finapp on every view. An operator can reverse a
// completed transfer later and only finapp's read shows it, so the page never renders from a cached answer -
// neither the send answer nor an earlier visit. A reversal is its own dated line beside the amount, never netted
// against it. Ledger identifiers are finapp's, not the customer's, and are not shown. A receipt offers no retry:
// sending again is a new transfer, started from Move money.
import { Card, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { TRANSFER_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, Money, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { ApiError } from '../../platform/api/api-error.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { ACCOUNTS_ROOT } from './api.ts';
import { transferFailureWords } from './labels.ts';

const messages = defineMessages({
  reversedOn: { id: 'transfer.reversedOn', defaultMessage: 'Reversed on' },
  title: { id: 'transfer.title', defaultMessage: 'Transfer' },
  back: { id: 'transfer.back', defaultMessage: 'Back to activity' },
  sent: { id: 'transfer.sent', defaultMessage: 'Sent' },
  reference: { id: 'transfer.reference', defaultMessage: 'Reference' },
  reversedBody: {
    id: 'transfer.reversed.body',
    defaultMessage: 'This transfer was reversed after it was sent.',
  },
  notFound: { id: 'transfer.notFound', defaultMessage: 'Only transfers you sent have details here.' },
  accounts: { id: 'transfer.accounts', defaultMessage: 'Go to your accounts' },
});

/** Missing, malformed and not-yours read the same (one neutral not-found). */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

export function useTransfer(transferId: string) {
  const api = useApi();
  return useQuery({
    queryKey: [ACCOUNTS_ROOT, 'transfer', transferId],
    queryFn: async () => ok(api.GET('/v1/transfers/{id}', { params: { path: { id: transferId } } })),
    // Re-read on every view: nothing is kept once the page is left, and nothing earlier is shown meanwhile.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

export function TransferPage() {
  const intl = useIntl();
  const { transferId } = useParams({ strict: false }) as { transferId: string };
  const transfer = useTransfer(transferId);

  if (transfer.isPending) return <LoadingState />;
  if (transfer.isError) {
    if (isNotFound(transfer.error)) {
      return (
        <Stack gap="sm">
          <Text>
            <FormattedMessage {...messages.notFound} />
          </Text>
          <Link to="/accounts">
            <FormattedMessage {...messages.accounts} />
          </Link>
        </Stack>
      );
    }
    return <ErrorExplained error={transfer.error} />;
  }
  const view = transfer.data.data;
  const status = view.status ?? 'UNKNOWN';

  return (
    <Stack gap="lg" maw={560}>
      <Link to="/activity">
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
          <StatusChip value={status} map={TRANSFER_STATUS} />
          {view.createdAt === undefined ? null : (
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.sent} />: <Timestamp value={view.createdAt} withZone />
            </Text>
          )}
          {view.reference === undefined || view.reference === '' ? null : (
            <Text size="sm">
              <FormattedMessage {...messages.reference} />: {view.reference}
            </Text>
          )}
          {status === 'REVERSED' && view.reversedAt !== undefined ? (
            <Text size="sm" data-testid="transfer-reversal">
              <FormattedMessage {...messages.reversedOn} /> <Timestamp value={view.reversedAt} withZone />
            </Text>
          ) : null}
          <CorrelationReference correlationId={transfer.data.correlationId} />
        </Stack>
      </Card>
      {status === 'FAILED' ? <Text>{intl.formatMessage(transferFailureWords(view.failureReason))}</Text> : null}
      {status === 'REVERSED' ? (
        <Text>
          <FormattedMessage {...messages.reversedBody} />
        </Text>
      ) : null}
    </Stack>
  );
}
