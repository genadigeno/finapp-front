// A credit check's progress and answer (P18-TSK-028). Follows finapp until the request is decided or closed; while
// it is still being gathered the customer may cancel it. An answer shows what finapp approved, or the reasons it
// gives the customer - never a score, a threshold or a risk signal (INV-CRD-02, INV-CRD-04).
import { Anchor, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { CREDIT_OUTCOME, CREDIT_REQUEST_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, Money, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { pollUntil } from '../../platform/query/polling.ts';
import { CREDIT_ROOT } from './api.ts';
import { Facts, Reasons } from './CreditParts.tsx';
import { checkClosureText, productName } from './labels.ts';
import { FRESH_ON_VIEW } from '../../platform/query/query-client.ts';

const messages = defineMessages({
  title: { id: 'creditCheckStatus.title', defaultMessage: 'Your credit check' },
  working: {
    id: 'creditCheckStatus.working',
    defaultMessage: 'We are looking at your request. This page updates by itself; you can leave and come back.',
  },
  review: {
    id: 'creditCheckStatus.review',
    defaultMessage: 'A member of our team is looking at your request. This can take a few days.',
  },
  approved: { id: 'creditCheckStatus.approved', defaultMessage: 'We could lend you' },
  term: { id: 'creditCheckStatus.term', defaultMessage: 'Over' },
  validUntil: { id: 'creditCheckStatus.validUntil', defaultMessage: 'This answer is valid until' },
  apply: { id: 'creditCheckStatus.apply', defaultMessage: 'Apply now' },
  declined: { id: 'creditCheckStatus.declined', defaultMessage: 'We cannot lend you this at the moment.' },
  closed: { id: 'creditCheckStatus.closed', defaultMessage: 'This request closed without an answer.' },
  cancelled: { id: 'creditCheckStatus.cancelled', defaultMessage: 'You cancelled this request.' },
  cancel: { id: 'creditCheckStatus.cancel', defaultMessage: 'Cancel this request' },
  cancelTitle: { id: 'creditCheckStatus.cancel.title', defaultMessage: 'Cancel this credit check?' },
  cancelBody: {
    id: 'creditCheckStatus.cancel.body',
    defaultMessage: 'We will stop looking at it. You can ask again later.',
  },
  back: { id: 'creditCheckStatus.back', defaultMessage: 'Back to Credit' },
  giveConsent: { id: 'creditCheckStatus.giveConsent', defaultMessage: 'Give your consent again' },
});

const monthsMessage = defineMessage<{ months: string }>({ id: 'credit.months', defaultMessage: '{months} months' });

const TERMINAL = new Set(['DECIDED', 'CANCELLED', 'EXPIRED', 'ABANDONED']);
/** finapp lets a request be cancelled only while it is still being gathered. */
const CANCELLABLE = new Set(['SUBMITTED', 'COLLECTING', 'READY']);

export function CreditCheckStatusPage() {
  const intl = useIntl();
  const api = useApi();
  const { requestId } = useParams({ strict: false }) as { requestId: string };
  const [confirming, setConfirming] = useState(false);
  const request = useQuery({
    queryKey: [CREDIT_ROOT, 'check', requestId],
    ...FRESH_ON_VIEW,
    queryFn: async () => ok(api.GET('/v1/me/credit/decision-requests/{id}', { params: { path: { id: requestId } } })),
    refetchInterval: pollUntil((answer: { data: { status?: string } }) => TERMINAL.has(answer.data.status ?? '')),
  });
  const cancel = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) =>
      ok(
        api.POST('/v1/me/credit/decision-requests/{id}/cancellation', {
          params: { path: { id: intent.body.id }, header: intent.headers() },
        }),
      ),
    { invalidate: [CREDIT_ROOT], routeId: '/credit/checks/$requestId' },
  );

  if (request.isPending) return <LoadingState />;
  if (request.isError) return <ErrorExplained error={request.error} onRetry={() => void request.refetch()} />;
  const view = request.data.data;
  const status = view.status ?? '';
  const product = productName(view.product);
  const cancelFailure = failureOf(cancel.state);
  // Why it closed, in our words only - finapp's statusText is never shown.
  const closure = checkClosureText(view.closureReason);

  return (
    <Stack gap="lg" maw={560}>
      <Link to="/credit">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <Group gap="sm">
            <StatusChip value={status} map={CREDIT_REQUEST_STATUS} />
            {view.outcome === undefined ? null : <StatusChip value={view.outcome} map={CREDIT_OUTCOME} />}
          </Group>
          {product === undefined ? null : (
            <Text size="sm" c="dimmed">
              {intl.formatMessage(product)}
            </Text>
          )}
          {status === 'IN_REVIEW' ? (
            <Text>
              <FormattedMessage {...messages.review} />
            </Text>
          ) : !TERMINAL.has(status) ? (
            <Text>
              <FormattedMessage {...messages.working} />
            </Text>
          ) : view.outcome === 'APPROVED' ? (
            <Stack gap="sm">
              <Facts
                rows={[
                  {
                    label: intl.formatMessage(messages.approved),
                    value:
                      view.approvedAmount === undefined || view.currency === undefined ? null : (
                        <Money amount={view.approvedAmount} currency={view.currency} />
                      ),
                    emphasis: true,
                  },
                  ...(view.approvedTermMonths === undefined
                    ? []
                    : [
                        {
                          label: intl.formatMessage(messages.term),
                          value: intl.formatMessage(monthsMessage, { months: String(view.approvedTermMonths) }),
                        },
                      ]),
                  ...(view.validUntil === undefined
                    ? []
                    : [
                        {
                          label: intl.formatMessage(messages.validUntil),
                          value: <Timestamp value={view.validUntil} />,
                        },
                      ]),
                ]}
              />
              <div>
                <Button renderRoot={(props) => <Link {...props} to="/credit/apply" />}>
                  <FormattedMessage {...messages.apply} />
                </Button>
              </div>
            </Stack>
          ) : view.outcome === 'DECLINED' ? (
            <Stack gap="sm">
              <Text>
                <FormattedMessage {...messages.declined} />
              </Text>
              <Reasons reasons={view.reasons} />
            </Stack>
          ) : (
            <Text>
              <FormattedMessage {...(status === 'CANCELLED' ? messages.cancelled : messages.closed)} />
            </Text>
          )}
          {closure === undefined ? null : (
            <Text>
              <FormattedMessage {...closure} />
            </Text>
          )}
          {view.closureReason === 'CONSENT_WITHDRAWN' ? (
            <Anchor renderRoot={(props) => <Link {...props} to="/onboarding/consents" />}>
              <FormattedMessage {...messages.giveConsent} />
            </Anchor>
          ) : null}
          <CorrelationReference correlationId={request.data.correlationId} />
        </Stack>
      </Card>
      {CANCELLABLE.has(status) ? (
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
          void cancel.submit({ id: requestId }).finally(() => {
            setConfirming(false);
            void request.refetch();
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
