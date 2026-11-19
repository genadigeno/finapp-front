// Report a problem with a pay-later purchase (P18-TSK-030): a dispute with the shop. While it is open finapp may
// pause instalments and the shop has until a deadline to respond. finapp gives a customer no way to read a dispute
// afterwards (G-13): this page shows everything finapp answers when it is opened, and the customer can withdraw it
// from here.
import { Button, Stack, Text, Textarea, Title, Radio } from '@mantine/core';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { DISPUTE_STATUS } from '../../design-system/status.ts';
import { Money, MoneyInput, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT, useBnplAgreement } from './api.ts';
import { Facts } from './CreditParts.tsx';
import { categoryName, DISPUTE_CATEGORIES, type DisputeCategory } from './labels.ts';

/** finapp's limit on the reason's length. */
const REASON_MAX = 1000;

const messages = defineMessages({
  title: { id: 'dispute.title', defaultMessage: 'Report a problem with the purchase' },
  intro: {
    id: 'dispute.intro',
    defaultMessage: 'We ask the shop to respond. While it is open, some of your payments may be paused.',
  },
  stepDetails: { id: 'dispute.step.details', defaultMessage: 'Details' },
  stepReview: { id: 'dispute.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'dispute.step.done', defaultMessage: 'Sent' },
  category: { id: 'dispute.category', defaultMessage: 'What went wrong?' },
  amount: { id: 'dispute.amount', defaultMessage: 'Amount in dispute' },
  reason: { id: 'dispute.reason', defaultMessage: 'Tell us what happened' },
  chooseCategory: { id: 'dispute.chooseCategory', defaultMessage: 'Choose what went wrong.' },
  needReason: { id: 'dispute.needReason', defaultMessage: 'Tell us what happened.' },
  continue: { id: 'dispute.continue', defaultMessage: 'Continue' },
  review: { id: 'dispute.review', defaultMessage: 'Check before you send' },
  confirm: { id: 'dispute.confirm', defaultMessage: 'Send to the shop' },
  offline: { id: 'dispute.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'dispute.sending', defaultMessage: 'Sending…' },
  done: { id: 'dispute.done', defaultMessage: 'Your dispute is open' },
  reference: { id: 'dispute.reference', defaultMessage: 'Dispute reference' },
  status: { id: 'dispute.status', defaultMessage: 'Status' },
  deadline: { id: 'dispute.deadline', defaultMessage: 'The shop has until' },
  keepNote: {
    id: 'dispute.keepNote',
    defaultMessage: 'You cannot see this dispute here once you leave this page yet. Note the reference.',
  },
  withdraw: { id: 'dispute.withdraw', defaultMessage: 'Withdraw this dispute' },
  withdrawTitle: { id: 'dispute.withdraw.title', defaultMessage: 'Withdraw this dispute?' },
  withdrawBody: {
    id: 'dispute.withdraw.body',
    defaultMessage: 'Your paused payments start again. You cannot open another dispute for 30 days.',
  },
  withdrawn: { id: 'dispute.withdrawn', defaultMessage: 'You withdrew this dispute.' },
  backToPlan: { id: 'repay.backToPlan', defaultMessage: 'Back to your plan' },
});

const pausedMessage = defineMessage<{ count: number }>({
  id: 'dispute.paused',
  defaultMessage: '{count, plural, one {# payment is} other {# payments are}} paused while it is open.',
});

interface Dispute {
  category: DisputeCategory;
  amount: string;
  currency: string;
  reason: string;
}

export function DisputePage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const { agreementId } = useParams({ strict: false }) as { agreementId: string };
  const agreement = useBnplAgreement(agreementId);
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [problems, setProblems] = useState<{ category?: string; amount?: MoneyInputProblem; reason?: string }>({});
  const [withdrawing, setWithdrawing] = useState(false);
  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<Dispute>) =>
      ok(
        api.POST('/v1/me/bnpl-agreements/{id}/disputes', {
          body: { ...intent.body },
          params: { path: { id: agreementId }, header: intent.headers() },
        }),
      ),
    { invalidate: [CREDIT_ROOT], routeId: '/credit/pay-later/$agreementId/dispute' },
  );
  const withdraw = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) =>
      ok(
        api.POST('/v1/me/bnpl-disputes/{id}/withdrawal', {
          params: { path: { id: intent.body.id }, header: intent.headers() },
        }),
      ),
    { invalidate: [CREDIT_ROOT], routeId: '/credit/pay-later/$agreementId/dispute' },
  );

  if (agreement.isPending) return <LoadingState />;
  if (agreement.isError) return <ErrorExplained error={agreement.error} onRetry={() => void agreement.refetch()} />;
  const currency = agreement.data.data.currency ?? '';
  const back = () => navigate({ to: '/credit/pay-later/$agreementId', params: { agreementId } });

  const toReview = () => {
    const next: typeof problems = {};
    if (category === null) next.category = intl.formatMessage(messages.chooseCategory);
    const parsed = parseMoneyInput(amountText, currency, intl.locale);
    if (!parsed.ok) next.amount = parsed.problem;
    if (reason.trim() === '') next.reason = intl.formatMessage(messages.needReason);
    setProblems(next);
    if (category === null || !parsed.ok || reason.trim() === '') return;
    flow.review({ category, amount: parsed.amount, currency, reason: reason.trim() });
  };

  const body = flow.body;
  const steps = [messages.stepDetails, messages.stepReview, messages.stepDone].map((m) => intl.formatMessage(m));
  // The withdrawal's answer is the dispute as it now stands.
  const opened =
    withdraw.state.status === 'succeeded'
      ? withdraw.state.data
      : flow.state.status === 'succeeded'
        ? flow.state.data
        : undefined;
  const withdrawFailure = failureOf(withdraw.state);

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Wizard steps={steps} current={flow.step === 'details' ? 0 : flow.step === 'review' ? 1 : 2}>
        {flow.step === 'details' ? (
          <Stack>
            <Text>
              <FormattedMessage {...messages.intro} />
            </Text>
            <Radio.Group
              label={intl.formatMessage(messages.category)}
              value={category}
              onChange={(value) => setCategory(DISPUTE_CATEGORIES.find((code) => code === value) ?? null)}
              error={problems.category}
            >
              <Stack mt="xs" gap={4}>
                {DISPUTE_CATEGORIES.map((code) => (
                  <Radio key={code} value={code} label={intl.formatMessage(categoryName(code))} />
                ))}
              </Stack>
            </Radio.Group>
            <MoneyInput
              label={intl.formatMessage(messages.amount)}
              value={amountText}
              onChange={setAmountText}
              currency={currency}
              problem={problems.amount}
            />
            <Textarea
              label={intl.formatMessage(messages.reason)}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              maxLength={REASON_MAX}
              autosize
              minRows={3}
              error={problems.reason}
            />
            <div>
              <Button onClick={toReview}>
                <FormattedMessage {...messages.continue} />
              </Button>
            </div>
            <Link to="/credit/pay-later/$agreementId" params={{ agreementId }}>
              <FormattedMessage {...messages.backToPlan} />
            </Link>
          </Stack>
        ) : flow.step === 'review' && body !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.review)}
            rows={[
              { label: intl.formatMessage(messages.category), value: intl.formatMessage(categoryName(body.category)) },
              {
                label: intl.formatMessage(messages.amount),
                value: <Money amount={body.amount} currency={body.currency} />,
                emphasis: true,
              },
              { label: intl.formatMessage(messages.reason), value: body.reason },
            ]}
            notice={
              online ? undefined : (
                <Text size="sm">
                  <FormattedMessage {...messages.offline} />
                </Text>
              )
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={!online}
            onConfirm={async () => {
              await flow.confirm();
            }}
            onBack={flow.back}
          />
        ) : opened !== undefined ? (
          <ResultPanel
            kind={opened.status === 'WITHDRAWN' ? 'succeeded' : 'pending'}
            title={intl.formatMessage(opened.status === 'WITHDRAWN' ? messages.withdrawn : messages.done)}
            correlationId={
              withdraw.state.status === 'succeeded'
                ? withdraw.state.correlationId
                : flow.state.status === 'succeeded'
                  ? flow.state.correlationId
                  : undefined
            }
            actions={
              <>
                <Button onClick={() => void back()}>
                  <FormattedMessage {...messages.backToPlan} />
                </Button>
                {opened.status === 'OPEN' && opened.disputeId !== undefined ? (
                  <Button variant="default" onClick={() => setWithdrawing(true)}>
                    <FormattedMessage {...messages.withdraw} />
                  </Button>
                ) : null}
              </>
            }
          >
            <FormattedMessage {...messages.keepNote} />
          </ResultPanel>
        ) : flow.state.status === 'refused' || flow.state.status === 'unknown' ? (
          <CommandOutcome
            state={flow.state}
            onChange={flow.back}
            onCheck={() => void back()}
            onSendSame={() => void flow.confirm()}
          />
        ) : (
          <LoadingState label={intl.formatMessage(messages.sending)} />
        )}
      </Wizard>
      {opened === undefined ? null : (
        <Facts
          rows={[
            ...(opened.disputeId === undefined
              ? []
              : [
                  {
                    label: intl.formatMessage(messages.reference),
                    value: <span className="finapp-mono">{opened.disputeId}</span>,
                  },
                ]),
            {
              label: intl.formatMessage(messages.status),
              value: <StatusChip value={opened.status ?? ''} map={DISPUTE_STATUS} />,
            },
            ...(opened.responseDeadline === undefined || opened.status === 'WITHDRAWN'
              ? []
              : [
                  {
                    label: intl.formatMessage(messages.deadline),
                    value: <Timestamp value={opened.responseDeadline} />,
                  },
                ]),
          ]}
        />
      )}
      {opened?.heldInstalments === undefined || opened.heldInstalments === 0 || opened.status === 'WITHDRAWN' ? null : (
        <Text size="sm">{intl.formatMessage(pausedMessage, { count: opened.heldInstalments })}</Text>
      )}
      {withdrawFailure === undefined ? null : <ErrorExplained error={withdrawFailure.error} />}
      <ConfirmDangerous
        opened={withdrawing}
        title={intl.formatMessage(messages.withdrawTitle)}
        confirmLabel={intl.formatMessage(messages.withdraw)}
        busy={withdraw.state.status === 'sending'}
        onCancel={() => setWithdrawing(false)}
        onConfirm={() => {
          const disputeId = opened?.disputeId;
          if (disputeId === undefined) return;
          void withdraw.submit({ id: disputeId }).finally(() => setWithdrawing(false));
        }}
      >
        <Text>
          <FormattedMessage {...messages.withdrawBody} />
        </Text>
      </ConfirmDangerous>
    </Stack>
  );
}
