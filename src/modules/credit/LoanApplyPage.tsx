// Apply for a loan or credit line (P18-TSK-029). The money is paid into the customer's wallet and repayments are
// taken from it - the only payout and repayment finapp offers a customer here (paying out to a bank account needs a
// linked account, G-19). finapp answers later (202): the application's page follows it to an offer.
import { Button, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { LoadingState } from '../../design-system/States.tsx';
import { ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT } from './api.ts';
import { useCreditForm, useCreditRows, type CreditRequest } from './CreditCheckPage.tsx';
import { ConsentLink } from './CreditParts.tsx';
import { REPAYMENT_DAYS } from './labels.ts';

const messages = defineMessages({
  title: { id: 'loanApply.title', defaultMessage: 'Apply for a loan or credit line' },
  intro: {
    id: 'loanApply.intro',
    defaultMessage: 'If we can lend, you get an offer to read before you decide. Applying does not commit you.',
  },
  stepDetails: { id: 'loanApply.step.details', defaultMessage: 'Details' },
  stepReview: { id: 'loanApply.step.review', defaultMessage: 'Review' },
  stepSent: { id: 'loanApply.step.sent', defaultMessage: 'Sent' },
  day: { id: 'loanApply.day', defaultMessage: 'Day of the month you repay' },
  chooseDay: { id: 'loanApply.chooseDay', defaultMessage: 'Choose a day of the month.' },
  continue: { id: 'loanApply.continue', defaultMessage: 'Continue' },
  review: { id: 'loanApply.review', defaultMessage: 'Check your application' },
  confirm: { id: 'loanApply.confirm', defaultMessage: 'Send my application' },
  wallet: {
    id: 'loanApply.wallet',
    defaultMessage: 'The money is paid into your wallet, and repayments are taken from it.',
  },
  notice: {
    id: 'loanApply.notice',
    defaultMessage: 'We will ask for the code from your authenticator app.',
  },
  offline: { id: 'loanApply.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'loanApply.sending', defaultMessage: 'Sending…' },
  back: { id: 'loanApply.back', defaultMessage: 'Back to Credit' },
});

const dayMessage = defineMessage<{ day: string }>({ id: 'loanApply.dayOption', defaultMessage: 'Day {day}' });

interface Application extends CreditRequest {
  repaymentDay: number;
  repaymentMethod: 'WALLET';
  payoutPreference?: 'WALLET';
}

export function LoanApplyPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const form = useCreditForm();
  const rows = useCreditRows();
  const [day, setDay] = useState<string | null>(null);
  const [dayProblem, setDayProblem] = useState<string | undefined>();
  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<Application>) =>
      ok(api.POST('/v1/me/loan-applications', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { invalidate: [CREDIT_ROOT], routeId: '/credit/apply' },
  );

  const applicationId = flow.state.status === 'succeeded' ? flow.state.data.applicationId : undefined;
  useEffect(() => {
    if (applicationId !== undefined) {
      void navigate({ to: '/credit/applications/$applicationId', params: { applicationId } });
    }
  }, [applicationId, navigate]);

  const steps = [messages.stepDetails, messages.stepReview, messages.stepSent].map((m) => intl.formatMessage(m));
  const body = flow.body;

  const toReview = () => {
    const request = form.validate();
    setDayProblem(day === null ? intl.formatMessage(messages.chooseDay) : undefined);
    if (request === undefined || day === null) return;
    flow.review({
      ...request,
      repaymentDay: Number(day),
      repaymentMethod: 'WALLET',
      // A credit line pays out by drawing; only a loan names its payout.
      ...(request.product === 'PERSONAL_LOAN' ? { payoutPreference: 'WALLET' as const } : {}),
    });
  };

  return (
    <Stack gap="lg" maw={560}>
      <Link to="/credit">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text>
        <FormattedMessage {...messages.intro} />
      </Text>
      <Wizard steps={steps} current={flow.step === 'details' ? 0 : flow.step === 'review' ? 1 : 2}>
        {flow.step === 'details' ? (
          <Stack>
            {form.fields}
            <Select
              label={intl.formatMessage(messages.day)}
              data={REPAYMENT_DAYS.map((value) => ({ value, label: intl.formatMessage(dayMessage, { day: value }) }))}
              value={day}
              onChange={setDay}
              error={dayProblem}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
            />
            <Text size="sm">
              <FormattedMessage {...messages.wallet} />
            </Text>
            <div>
              <Button onClick={toReview}>
                <FormattedMessage {...messages.continue} />
              </Button>
            </div>
          </Stack>
        ) : flow.step === 'review' && body !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.review)}
            rows={[
              ...rows(body),
              {
                label: intl.formatMessage(messages.day),
                value: intl.formatMessage(dayMessage, { day: String(body.repaymentDay) }),
              },
            ]}
            notice={
              <Stack gap={6}>
                <Text size="sm">
                  <FormattedMessage {...messages.wallet} />
                </Text>
                <Text size="sm">
                  <FormattedMessage {...(online ? messages.notice : messages.offline)} />
                </Text>
              </Stack>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={!online}
            onConfirm={async () => {
              await flow.confirm();
            }}
            onBack={flow.back}
          />
        ) : flow.state.status === 'refused' || flow.state.status === 'unknown' ? (
          <Stack>
            <CommandOutcome state={flow.state} onChange={flow.back} onSendSame={() => void flow.confirm()} />
            <ConsentLink error={flow.state.error} />
          </Stack>
        ) : (
          <LoadingState label={intl.formatMessage(messages.sending)} />
        )}
      </Wizard>
    </Stack>
  );
}
