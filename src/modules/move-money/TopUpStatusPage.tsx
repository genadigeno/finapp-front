// A top-up still in progress (P18-TSK-023, -027): follows finapp until the payment settles (bounded backoff,
// resumes on focus), offers the bank-approval link while finapp shows one, and lets the customer cancel while the
// payment has not been confirmed. Never shows success finapp has not reported.
import { Alert, Anchor, Button, Card, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { PAYMENT_INTENT_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, Money, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { pollUntil } from '../../platform/query/polling.ts';
import { safeAuthorizationUrl, topUpFailure } from './labels.ts';

const messages = defineMessages({
  title: { id: 'topUpStatus.title', defaultMessage: 'Your top-up' },
  approve: { id: 'topUpStatus.approve', defaultMessage: 'Approve the payment at your bank' },
  approveBody: {
    id: 'topUpStatus.approve.body',
    defaultMessage:
      'Your bank asks you to approve this payment. Come back here afterwards - this page updates by itself.',
  },
  processing: {
    id: 'topUpStatus.processing',
    defaultMessage:
      'We are waiting for the payment to complete. This page updates by itself; you can leave and come back.',
  },
  done: { id: 'topUpStatus.done', defaultMessage: 'The money is in your wallet.' },
  cancelled: { id: 'topUpStatus.cancelled', defaultMessage: 'This payment was cancelled. Nothing was charged.' },
  cancel: { id: 'topUpStatus.cancel', defaultMessage: 'Cancel this payment' },
  started: { id: 'topUpStatus.started', defaultMessage: 'Started' },
  back: { id: 'topUpStatus.back', defaultMessage: 'Back to Move money' },
});

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

export function TopUpStatusPage() {
  const intl = useIntl();
  const api = useApi();
  const { paymentId } = useParams({ strict: false }) as { paymentId: string };
  const payment = useQuery({
    queryKey: [ACCOUNTS_ROOT, 'payment', paymentId],
    queryFn: async () => ok(api.GET('/v1/payments/{id}', { params: { path: { id: paymentId } } })),
    refetchInterval: pollUntil((answer: { data: { status?: string } }) => TERMINAL.has(answer.data.status ?? '')),
  });
  const cancel = useCommand(async () => ok(api.DELETE('/v1/payments/{id}', { params: { path: { id: paymentId } } })), {
    invalidate: [ACCOUNTS_ROOT],
    routeId: '/move/top-ups/$paymentId',
  });

  if (payment.isPending) return <LoadingState />;
  if (payment.isError) return <ErrorExplained error={payment.error} onRetry={() => void payment.refetch()} />;
  const view = payment.data.data;
  const status = view.status ?? 'UNKNOWN';
  const link = safeAuthorizationUrl(view.authorizationHandle);
  const cancelFailure = failureOf(cancel.state);

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
          <StatusChip value={status} map={PAYMENT_INTENT_STATUS} />
          {view.createdAt === undefined ? null : (
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.started} />: <Timestamp value={view.createdAt} withZone />
            </Text>
          )}
          <CorrelationReference correlationId={payment.data.correlationId} />
        </Stack>
      </Card>
      {link !== undefined && status === 'PROCESSING' ? (
        <Alert variant="light" color="navy" title={intl.formatMessage(messages.approve)}>
          <Stack gap="sm">
            <Text>
              <FormattedMessage {...messages.approveBody} />
            </Text>
            <Anchor href={link} rel="noreferrer">
              <FormattedMessage {...messages.approve} />
            </Anchor>
          </Stack>
        </Alert>
      ) : status === 'PROCESSING' ? (
        <Text>
          <FormattedMessage {...messages.processing} />
        </Text>
      ) : status === 'SUCCEEDED' ? (
        <Text>
          <FormattedMessage {...messages.done} />
        </Text>
      ) : status === 'FAILED' ? (
        <Text>{intl.formatMessage(topUpFailure(view.failureReason))}</Text>
      ) : status === 'CANCELLED' ? (
        <Text>
          <FormattedMessage {...messages.cancelled} />
        </Text>
      ) : null}
      {status === 'REQUIRES_CONFIRMATION' ? (
        <div>
          <Button variant="default" onClick={() => void cancel.submit({})} loading={cancel.state.status === 'sending'}>
            <FormattedMessage {...messages.cancel} />
          </Button>
        </div>
      ) : null}
      {cancelFailure === undefined ? null : <ErrorExplained error={cancelFailure.error} />}
    </Stack>
  );
}
