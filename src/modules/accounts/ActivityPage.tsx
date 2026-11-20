// Your activity (P18-TSK-020): the two lists finapp serves the customer, newest first as finapp orders them -
// transfers the customer SENT (incoming money is not in it), and top-ups and wallet purchases. finapp has no
// single activity read (G-02) and no paged lists (G-01), so the page shows each list whole, says what it covers,
// and points to the statement for everything that moved - it never merges, re-sorts or totals them.
import { Alert, Card, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { PAYMENT_INTENT_STATUS, TRANSFER_STATUS } from '../../design-system/status.ts';
import { Money, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { ACCOUNTS_ROOT } from './api.ts';
import { isNonZero } from '../../design-system/money.ts';

const messages = defineMessages({
  refundPending: { id: 'activity.refundPending', defaultMessage: 'Refund on its way' },
  refunded: { id: 'activity.refunded', defaultMessage: 'Refunded' },
  title: { id: 'activity.title', defaultMessage: 'Activity' },
  transfers: { id: 'activity.transfers', defaultMessage: 'Transfers sent' },
  payments: { id: 'activity.payments', defaultMessage: 'Top-ups and purchases' },
  noTransfers: { id: 'activity.noTransfers', defaultMessage: 'You have not sent any transfers' },
  noPayments: { id: 'activity.noPayments', defaultMessage: 'No top-ups or purchases yet' },
  note: {
    id: 'activity.note',
    defaultMessage:
      'Money you received is not listed here. For everything that moved in or out of your wallet, open its statement.',
  },
  statement: { id: 'activity.statement', defaultMessage: 'Go to your accounts' },
  reference: { id: 'activity.reference', defaultMessage: 'Reference' },
  details: { id: 'activity.details', defaultMessage: 'View receipt' },
});

interface Movement {
  id: string;
  amount: string;
  currency: string;
  status: string | undefined;
  createdAt: string | undefined;
  reference: string | undefined;
  reversedAt: string | undefined;
  /** A payment's refunds, exactly as finapp reports them; nothing is derived from them. */
  refunded: string | undefined;
  refundPending: string | undefined;
}

function useTransfers() {
  const api = useApi();
  return useQuery({
    queryKey: [ACCOUNTS_ROOT, 'transfers'],
    queryFn: async (): Promise<Movement[]> => {
      const { data } = await ok(api.GET('/v1/transfers'));
      return data.flatMap((t) =>
        t.id === undefined || t.amount === undefined || t.currency === undefined
          ? []
          : [
              {
                id: t.id,
                amount: t.amount,
                currency: t.currency,
                status: t.status,
                createdAt: t.createdAt,
                reference: t.reference,
                reversedAt: t.reversedAt,
                refunded: undefined,
                refundPending: undefined,
              },
            ],
      );
    },
  });
}

function usePayments() {
  const api = useApi();
  return useQuery({
    queryKey: [ACCOUNTS_ROOT, 'payments'],
    queryFn: async (): Promise<Movement[]> => {
      const { data } = await ok(api.GET('/v1/payments'));
      return data.flatMap((p) =>
        p.id === undefined || p.amount === undefined || p.currency === undefined
          ? []
          : [
              {
                id: p.id,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                createdAt: p.createdAt,
                reference: undefined,
                reversedAt: undefined,
                refunded: p.refunded,
                refundPending: p.refundPending,
              },
            ],
      );
    },
  });
}

function MovementList({
  query,
  statusMap,
  empty,
  receipts = false,
}: {
  query: ReturnType<typeof useTransfers>;
  statusMap: typeof TRANSFER_STATUS | typeof PAYMENT_INTENT_STATUS;
  empty: string;
  /** Each movement links to its receipt (transfers only). */
  receipts?: boolean;
}) {
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorExplained error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState title={empty} />;
  return (
    <Stack gap="sm">
      {query.data.map((movement) => (
        <Card key={movement.id} withBorder radius="md" padding="md">
          <Group justify="space-between" wrap="wrap" align="flex-start">
            <Stack gap={2}>
              {movement.createdAt === undefined ? null : (
                <Text size="sm" c="dimmed">
                  <Timestamp value={movement.createdAt} />
                </Text>
              )}
              {movement.reference === undefined ? null : (
                <Text size="sm">
                  <FormattedMessage {...messages.reference} />: {movement.reference}
                </Text>
              )}
              {movement.status === undefined ? null : <StatusChip value={movement.status} map={statusMap} />}
              {isNonZero(movement.refunded) ? (
                <Text size="sm">
                  <FormattedMessage {...messages.refunded} />{' '}
                  <Money amount={movement.refunded} currency={movement.currency} />
                </Text>
              ) : null}
              {isNonZero(movement.refundPending) ? (
                <Text size="sm">
                  <FormattedMessage {...messages.refundPending} />{' '}
                  <Money amount={movement.refundPending} currency={movement.currency} />
                </Text>
              ) : null}
              {receipts ? (
                <Link to="/activity/transfers/$transferId" params={{ transferId: movement.id }}>
                  <FormattedMessage {...messages.details} />
                </Link>
              ) : null}
            </Stack>
            <Money amount={movement.amount} currency={movement.currency} size="lg" />
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

export function ActivityPage() {
  const intl = useIntl();
  const transfers = useTransfers();
  const payments = usePayments();
  return (
    <Stack gap="lg">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Alert variant="light" color="gray">
        <FormattedMessage {...messages.note} />{' '}
        <Link to="/accounts">
          <FormattedMessage {...messages.statement} />
        </Link>
      </Alert>
      <Tabs defaultValue="transfers" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="transfers">{intl.formatMessage(messages.transfers)}</Tabs.Tab>
          <Tabs.Tab value="payments">{intl.formatMessage(messages.payments)}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="transfers" pt="md">
          <MovementList
            query={transfers}
            statusMap={TRANSFER_STATUS}
            empty={intl.formatMessage(messages.noTransfers)}
            receipts
          />
        </Tabs.Panel>
        <Tabs.Panel value="payments" pt="md">
          <MovementList
            query={payments}
            statusMap={PAYMENT_INTENT_STATUS}
            empty={intl.formatMessage(messages.noPayments)}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
