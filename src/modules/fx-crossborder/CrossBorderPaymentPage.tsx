// An overseas payment's progress (P18-TSK-026, -027): follows finapp until it is delivered, returned, failed or
// cancelled. While finapp can still recall it, the customer may ask to cancel; the answer comes later as a status,
// never assumed. A failure or return says what happened to the money - never why (INV-RSK-08).
// D-R WP-2: who it went to, and what the customer agreed (the offer, read once) - figures only, never the offer's
// status; the payment's status comes from the payment read alone.
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { CROSS_BORDER_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, Money, Rate, StatusChip } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { pollUntil } from '../../platform/query/polling.ts';
import { useAgreedOffer, useRecipient, XB_ROOT } from './api.ts';
import { countryName, fractionToPercent, RECIPIENT_STATUS } from './labels.ts';
import { EstimateText } from './SendAbroadPage.tsx';

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
    // A returned payment may come back less a fee: never claim the full total came back (D-R WP-2).
    defaultMessage: 'The money came back to your wallet, less any fee. See your statement.',
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
  agreed: { id: 'xbPayment.agreed', defaultMessage: 'What you agreed' },
  send: { id: 'xbPayment.agreed.send', defaultMessage: 'You send' },
  fee: { id: 'xbPayment.agreed.fee', defaultMessage: 'Fee' },
  total: { id: 'xbPayment.agreed.total', defaultMessage: 'Total taken from your wallet' },
  receives: { id: 'xbPayment.agreed.receives', defaultMessage: 'They receive (guaranteed)' },
  rate: { id: 'xbPayment.agreed.rate', defaultMessage: 'Rate' },
});

const marginMessage = defineMessage<{ percent: string }>({
  id: 'xbPayment.agreed.margin',
  defaultMessage: 'The rate includes our margin of {percent}% over the mid-market rate.',
});
const recipientMessage = defineMessage<{ who: string }>({ id: 'xbPayment.recipient', defaultMessage: 'To {who}' });
const suffixMessage = defineMessage<{ suffix: string }>({
  id: 'xbPayment.recipient.suffix',
  defaultMessage: 'account ending {suffix}',
});

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="wrap" gap="xs">
      <Text c="dimmed">{label}</Text>
      <Text component="div">{children}</Text>
    </Group>
  );
}

/**
 * Who the payment went to: nickname (plain text), the suffix finapp gives, the country - and the recipient's status in
 * words, never a reason. Shown even when the recipient has since been removed. Nothing when the read fails.
 */
function RecipientLine({ beneficiaryId }: { beneficiaryId: string | undefined }) {
  const intl = useIntl();
  const recipient = useRecipient(beneficiaryId);
  if (recipient.data === undefined) return null;
  const view = recipient.data;
  const who = [
    view.nickname,
    view.suffix === undefined ? undefined : intl.formatMessage(suffixMessage, { suffix: view.suffix }),
    countryName(view.country, intl.locale),
  ]
    .filter((part): part is string => part !== undefined && part !== '')
    .join(', ');
  if (who === '') return null;
  return (
    <Group gap="xs" wrap="wrap">
      <Text>{intl.formatMessage(recipientMessage, { who })}</Text>
      {view.status === undefined ? null : <StatusChip value={view.status} map={RECIPIENT_STATUS} />}
    </Group>
  );
}

/**
 * What the customer agreed, from the offer the payment was made on - read once, never polled. Every figure is
 * finapp's string; nothing is added up here. The offer's own status is never shown: the payment's status comes only
 * from the payment read. If the read fails, or answers for another offer, no figures are shown.
 */
function AgreedCard({ quoteId }: { quoteId: string | undefined }) {
  const intl = useIntl();
  const offer = useAgreedOffer(quoteId);
  if (offer.data === undefined || offer.data.id !== quoteId) return null;
  const view = offer.data;
  const source = view.sourceCurrency;
  const destination = view.destinationCurrency;
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Title order={2} size="h4">
          <FormattedMessage {...messages.agreed} />
        </Title>
        {view.sourceAmount === undefined || source === undefined ? null : (
          <Row label={intl.formatMessage(messages.send)}>
            <Money amount={view.sourceAmount} currency={source} />
          </Row>
        )}
        {view.fee === undefined || source === undefined ? null : (
          <Row label={intl.formatMessage(messages.fee)}>
            <Money amount={view.fee} currency={source} />
          </Row>
        )}
        {view.totalDebit === undefined || source === undefined ? null : (
          <Row label={intl.formatMessage(messages.total)}>
            <Money amount={view.totalDebit} currency={source} />
          </Row>
        )}
        {view.destinationAmount === undefined || destination === undefined ? null : (
          <Row label={intl.formatMessage(messages.receives)}>
            <Money amount={view.destinationAmount} currency={destination} />
          </Row>
        )}
        {view.customerRate === undefined || source === undefined || destination === undefined ? null : (
          <Row label={intl.formatMessage(messages.rate)}>
            <Rate rate={view.customerRate} source={source} destination={destination} />
          </Row>
        )}
        {view.disclosedMarginOverMid === undefined ? null : (
          <Text size="sm">
            {intl.formatMessage(marginMessage, {
              percent: fractionToPercent(view.disclosedMarginOverMid) ?? view.disclosedMarginOverMid,
            })}
          </Text>
        )}
        <EstimateText hours={view.deliveryEstimateHours} />
      </Stack>
    </Card>
  );
}

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
          <div>
            <StatusChip value={status} map={CROSS_BORDER_STATUS} />
          </div>
          <Text>{KNOWN.has(status) ? intl.formatMessage(messages[status as Known]) : null}</Text>
          <RecipientLine beneficiaryId={view.beneficiaryId} />
          {view.cancellationRequested === true && status === 'PROCESSING' ? (
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.cancelAsked} />
            </Text>
          ) : null}
          <CorrelationReference correlationId={payment.data.correlationId} />
        </Stack>
      </Card>
      <AgreedCard quoteId={view.quoteId} />
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
