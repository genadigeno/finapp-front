// An overseas payment's progress (P18-TSK-026, -027): follows finapp until it is delivered, returned, failed or
// cancelled. While finapp can still recall it, the customer may ask to cancel; the answer comes later as a status,
// never assumed. A failure or return says what happened to the money - never why (INV-RSK-08).
import { Button, Card, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { CROSS_BORDER_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, StatusChip } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { pollUntil } from '../../platform/query/polling.ts';
import { XB_ROOT } from './api.ts';

const messages = defineMessages({
  title: { id: 'xbPayment.title', defaultMessage: 'Your payment abroad' },
  PROCESSING: {
    id: 'xbPayment.processing',
    defaultMessage: 'We are sending your payment. This page updates by itself; you can leave and come back.',
  },
  SENT: { id: 'xbPayment.sent', defaultMessage: 'Your payment is on its way to the recipient’s bank.' },
  DELIVERED: { id: 'xbPayment.delivered', defaultMessage: 'The recipient’s bank has the money.' },
  RETURNED: {
    id: 'xbPayment.returned',
    defaultMessage: 'The payment came back. The money is returned to your wallet.',
  },
  FAILED: {
    id: 'xbPayment.failed',
    defaultMessage: 'The payment could not be sent. The money is back in your wallet.',
  },
  CANCELLED: {
    id: 'xbPayment.cancelled',
    defaultMessage: 'The payment was cancelled. The money is back in your wallet.',
  },
  cancelAsked: {
    id: 'xbPayment.cancelAsked',
    defaultMessage: 'You asked to cancel. If it is not too late, the status will change to cancelled.',
  },
  cancel: { id: 'xbPayment.cancel', defaultMessage: 'Cancel this payment' },
  cancelTitle: { id: 'xbPayment.cancel.title', defaultMessage: 'Cancel this payment?' },
  cancelBody: {
    id: 'xbPayment.cancel.body',
    defaultMessage:
      'We will try to stop it. If it has already left, it cannot be cancelled and will arrive as planned.',
  },
  back: { id: 'xbPayment.back', defaultMessage: 'Back to Send abroad' },
});

const TERMINAL = new Set(['DELIVERED', 'RETURNED', 'FAILED', 'CANCELLED']);
type Known = 'PROCESSING' | 'SENT' | 'DELIVERED' | 'RETURNED' | 'FAILED' | 'CANCELLED';
const KNOWN: ReadonlySet<string> = new Set(['PROCESSING', 'SENT', 'DELIVERED', 'RETURNED', 'FAILED', 'CANCELLED']);

export function CrossBorderPaymentPage() {
  const intl = useIntl();
  const api = useApi();
  const { paymentId } = useParams({ strict: false }) as { paymentId: string };
  const [confirming, setConfirming] = useState(false);
  const payment = useQuery({
    queryKey: [XB_ROOT, 'payment', paymentId],
    queryFn: async () => ok(api.GET('/v1/me/cross-border/payments/{id}', { params: { path: { id: paymentId } } })),
    refetchInterval: pollUntil((answer: { data: { status?: string } }) => TERMINAL.has(answer.data.status ?? '')),
  });
  const cancel = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) =>
      ok(
        api.POST('/v1/me/cross-border/payments/{id}/cancellation', {
          params: { path: { id: intent.body.id }, header: intent.headers() },
        }),
      ),
    { invalidate: [XB_ROOT, ACCOUNTS_ROOT], routeId: '/send-abroad/payments/$paymentId' },
  );

  if (payment.isPending) return <LoadingState />;
  if (payment.isError) return <ErrorExplained error={payment.error} onRetry={() => void payment.refetch()} />;
  const view = payment.data.data;
  const status = view.status ?? 'UNKNOWN';
  const cancelFailure = failureOf(cancel.state);

  return (
    <Stack gap="lg" maw={560}>
      <Link to="/send-abroad">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <StatusChip value={status} map={CROSS_BORDER_STATUS} />
          <Text>{KNOWN.has(status) ? intl.formatMessage(messages[status as Known]) : null}</Text>
          {view.cancellationRequested === true && status === 'PROCESSING' ? (
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.cancelAsked} />
            </Text>
          ) : null}
          <CorrelationReference correlationId={payment.data.correlationId} />
        </Stack>
      </Card>
      {status === 'PROCESSING' && view.cancellationRequested !== true ? (
        <div>
          <Button variant="default" onClick={() => setConfirming(true)}>
            <FormattedMessage {...messages.cancel} />
          </Button>
        </div>
      ) : null}
      {cancelFailure === undefined ? null : <ErrorExplained error={cancelFailure.error} />}
      <ConfirmDangerous
        opened={confirming}
        title={intl.formatMessage(messages.cancelTitle)}
        confirmLabel={intl.formatMessage(messages.cancel)}
        busy={cancel.state.status === 'sending'}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          void cancel.submit({ id: paymentId }).finally(() => {
            setConfirming(false);
            void payment.refetch();
          })
        }
      >
        <Text>
          <FormattedMessage {...messages.cancelBody} />
        </Text>
      </ConfirmDangerous>
    </Stack>
  );
}
