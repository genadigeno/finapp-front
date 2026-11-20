// An application's progress (P18-TSK-029, -030): a loan or credit-line application, or a pay-later application
// made at a shop's checkout. Follows finapp until it is offered, declined or closed; while it waits for a decision
// the customer may withdraw it. A decline shows the reasons finapp gives the customer, nothing more (INV-CRD-04).
import { Button, Card, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { APPLICATION_STATUS } from '../../design-system/status.ts';
import { CorrelationReference, StatusChip } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok, type ApiSuccess } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { pollUntil } from '../../platform/query/polling.ts';
import { CREDIT_ROOT, type CreditKind } from './api.ts';
import { Reasons } from './CreditParts.tsx';
import { applicationClosureText, planName, productName } from './labels.ts';

const messages = defineMessages({
  title: { id: 'application.title', defaultMessage: 'Your application' },
  working: {
    id: 'application.working',
    defaultMessage: 'We are looking at your application. This page updates by itself; you can leave and come back.',
  },
  offered: { id: 'application.offered', defaultMessage: 'We have an offer for you. Read it before you decide.' },
  seeOffer: { id: 'application.seeOffer', defaultMessage: 'See your offer' },
  declined: { id: 'application.declined', defaultMessage: 'We cannot offer you this at the moment.' },
  closed: { id: 'application.closed', defaultMessage: 'This application closed without an offer.' },
  withdrawn: { id: 'application.withdrawn', defaultMessage: 'You withdrew this application.' },
  withdraw: { id: 'application.withdraw', defaultMessage: 'Withdraw this application' },
  withdrawTitle: { id: 'application.withdraw.title', defaultMessage: 'Withdraw this application?' },
  withdrawBody: {
    id: 'application.withdraw.body',
    defaultMessage: 'We will stop looking at it. You can apply again later.',
  },
  back: { id: 'application.back', defaultMessage: 'Back to Credit' },
});

const TERMINAL = new Set(['OFFERED', 'DECLINED', 'CLOSED_UNDECIDED', 'WITHDRAWN']);

interface ApplicationView {
  status?: string;
  product?: string;
  plan?: string;
  reasons?: string[];
  offerId?: string;
  /** Pay-later applications only (loan applications carry none). */
  closureReason?: string;
}

export function ApplicationStatusPage({ kind }: { kind: CreditKind }) {
  const intl = useIntl();
  const api = useApi();
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };
  const [confirming, setConfirming] = useState(false);
  const routeId =
    kind === 'loan' ? '/credit/applications/$applicationId' : '/credit/pay-later/applications/$applicationId';
  const application = useQuery({
    queryKey: [CREDIT_ROOT, kind, 'application', applicationId],
    queryFn: async (): Promise<ApiSuccess<ApplicationView>> =>
      kind === 'loan'
        ? ok(api.GET('/v1/me/loan-applications/{id}', { params: { path: { id: applicationId } } }))
        : ok(api.GET('/v1/me/bnpl-applications/{id}', { params: { path: { id: applicationId } } })),
    refetchInterval: pollUntil((answer: { data: ApplicationView }) => TERMINAL.has(answer.data.status ?? '')),
  });
  const withdraw = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) => {
      const init = { params: { path: { id: intent.body.id }, header: intent.headers() } };
      return kind === 'loan'
        ? ok(api.POST('/v1/me/loan-applications/{id}/withdrawal', init))
        : ok(api.POST('/v1/me/bnpl-applications/{id}/withdrawal', init));
    },
    { invalidate: [CREDIT_ROOT], routeId },
  );

  if (application.isPending) return <LoadingState />;
  if (application.isError) {
    return <ErrorExplained error={application.error} onRetry={() => void application.refetch()} />;
  }
  const view = application.data.data;
  const status = view.status ?? '';
  const name = planName(view.plan) ?? productName(view.product);
  const withdrawFailure = failureOf(withdraw.state);
  const offerId = view.offerId;
  // Why it closed, in our words; finapp's own text is never shown.
  const closure = kind === 'bnpl' ? applicationClosureText(view.closureReason) : undefined;

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
          <StatusChip value={status} map={APPLICATION_STATUS} />
          {name === undefined ? null : (
            <Text size="sm" c="dimmed">
              {intl.formatMessage(name)}
            </Text>
          )}
          {status === 'OFFERED' ? (
            <Stack gap="sm">
              <Text>
                <FormattedMessage {...messages.offered} />
              </Text>
              {offerId === undefined ? null : (
                <div>
                  <Button
                    renderRoot={(props) =>
                      kind === 'loan' ? (
                        <Link {...props} to="/credit/offers/$offerId" params={{ offerId }} />
                      ) : (
                        <Link {...props} to="/credit/pay-later/offers/$offerId" params={{ offerId }} />
                      )
                    }
                  >
                    <FormattedMessage {...messages.seeOffer} />
                  </Button>
                </div>
              )}
            </Stack>
          ) : status === 'DECLINED' ? (
            <Stack gap="sm">
              <Text>
                <FormattedMessage {...messages.declined} />
              </Text>
              <Reasons reasons={view.reasons} />
            </Stack>
          ) : status === 'WITHDRAWN' ? (
            <Text>
              <FormattedMessage {...messages.withdrawn} />
            </Text>
          ) : status === 'CLOSED_UNDECIDED' ? (
            <Stack gap="xs">
              <Text>
                <FormattedMessage {...messages.closed} />
              </Text>
              {closure === undefined ? null : (
                <Text>
                  <FormattedMessage {...closure} />
                </Text>
              )}
            </Stack>
          ) : (
            <Text>
              <FormattedMessage {...messages.working} />
            </Text>
          )}
          <CorrelationReference correlationId={application.data.correlationId} />
        </Stack>
      </Card>
      {TERMINAL.has(status) ? null : (
        <div>
          <Button variant="default" onClick={() => setConfirming(true)}>
            <FormattedMessage {...messages.withdraw} />
          </Button>
        </div>
      )}
      {withdrawFailure === undefined ? null : <ErrorExplained error={withdrawFailure.error} />}
      <ConfirmDangerous
        opened={confirming}
        title={intl.formatMessage(messages.withdrawTitle)}
        confirmLabel={intl.formatMessage(messages.withdraw)}
        busy={withdraw.state.status === 'sending'}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          void withdraw.submit({ id: applicationId }).finally(() => {
            setConfirming(false);
            void application.refetch();
          })
        }
      >
        <Text>
          <FormattedMessage {...messages.withdrawBody} />
        </Text>
      </ConfirmDangerous>
    </Stack>
  );
}

export const LoanApplicationPage = () => <ApplicationStatusPage kind="loan" />;
export const BnplApplicationPage = () => <ApplicationStatusPage kind="bnpl" />;
