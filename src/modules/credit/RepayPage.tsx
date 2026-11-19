// Repay (P18-TSK-029, -030): a repayment from the customer's wallet to a loan, a credit line or a pay-later plan -
// the only source finapp takes. On an instalment loan the customer may instead pay extra off what they borrowed
// (a prepayment): finapp then shortens or lowers the remaining payments and says how.
import { Button, Group, Radio, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { BusinessDate, Money, MoneyInput } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT, useBnplAgreement, useLoan, type CreditKind } from './api.ts';
import { Facts, MaybeMoney, type Fact } from './CreditParts.tsx';
import { isLine } from './labels.ts';

const messages = defineMessages({
  title: { id: 'repay.title', defaultMessage: 'Make a repayment' },
  stepDetails: { id: 'repay.step.details', defaultMessage: 'Amount' },
  stepReview: { id: 'repay.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'repay.step.done', defaultMessage: 'Done' },
  dueNow: { id: 'repay.dueNow', defaultMessage: 'Due now' },
  principalDue: { id: 'loan.principalDue', defaultMessage: 'Borrowed amount due now' },
  interestDue: { id: 'loan.interestDue', defaultMessage: 'Interest due now' },
  feesDue: { id: 'loan.feesDue', defaultMessage: 'Fees due now' },
  owed: { id: 'loan.owed', defaultMessage: 'You still owe (borrowed)' },
  mode: { id: 'repay.mode', defaultMessage: 'What are you paying?' },
  regular: { id: 'repay.mode.regular', defaultMessage: 'A repayment' },
  extra: { id: 'repay.mode.extra', defaultMessage: 'Extra, off what I borrowed' },
  extraHint: {
    id: 'repay.extraHint',
    defaultMessage: 'Paying extra lowers your remaining payments. Pay anything overdue first.',
  },
  amount: { id: 'repay.amount', defaultMessage: 'Amount' },
  continue: { id: 'repay.continue', defaultMessage: 'Continue' },
  review: { id: 'repay.review', defaultMessage: 'Check your repayment' },
  from: { id: 'repay.from', defaultMessage: 'From' },
  wallet: { id: 'repay.wallet', defaultMessage: 'Your wallet' },
  confirm: { id: 'repay.confirm', defaultMessage: 'Repay now' },
  notice: { id: 'repay.notice', defaultMessage: 'The money leaves your wallet now.' },
  offline: { id: 'repay.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'repay.sending', defaultMessage: 'Sending…' },
  done: { id: 'repay.done', defaultMessage: 'Repayment received' },
  newInstalment: { id: 'repay.newInstalment', defaultMessage: 'Your monthly payment is now' },
  nextDue: { id: 'repay.nextDue', defaultMessage: 'Next payment due' },
  remaining: { id: 'repay.remaining', defaultMessage: 'Payments left' },
  backToLoan: { id: 'repay.backToLoan', defaultMessage: 'Back to your loan' },
  backToPlan: { id: 'repay.backToPlan', defaultMessage: 'Back to your plan' },
});

type Mode = 'REGULAR' | 'EXTRA';

interface Repayment {
  mode: Mode;
  amount: string;
  currency: string;
}

interface RepaidView {
  amount?: string;
  currency?: string;
  // A prepayment's answer: the new shape of the remaining schedule.
  instalment?: string;
  nextDueDate?: string;
  remainingInstalments?: number;
  repayment?: { amount?: string; currency?: string };
}

export function RepayPage({ kind }: { kind: CreditKind }) {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const params = useParams({ strict: false }) as { loanId?: string; agreementId?: string };
  const id = (kind === 'loan' ? params.loanId : params.agreementId) ?? '';
  const loan = useLoan(id, kind === 'loan');
  const agreement = useBnplAgreement(id, kind === 'bnpl');
  const credit = kind === 'loan' ? loan : agreement;
  const [mode, setMode] = useState<Mode>('REGULAR');
  const [amountText, setAmountText] = useState('');
  const [problem, setProblem] = useState<MoneyInputProblem | undefined>();

  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<Repayment>) => {
      const { mode: chosen, ...body } = intent.body;
      const init = { body, params: { path: { id }, header: intent.headers() } };
      if (kind === 'bnpl') return ok(api.POST('/v1/me/bnpl-agreements/{id}/repayments', init));
      return chosen === 'EXTRA'
        ? ok(api.POST('/v1/me/loans/{id}/prepayments', init))
        : ok(api.POST('/v1/me/loans/{id}/repayments', init));
    },
    {
      invalidate: [CREDIT_ROOT, ACCOUNTS_ROOT],
      routeId: kind === 'loan' ? '/credit/loans/$loanId/repay' : '/credit/pay-later/$agreementId/repay',
    },
  );

  if (credit.isPending) return <LoadingState />;
  if (credit.isError) return <ErrorExplained error={credit.error} onRetry={() => void credit.refetch()} />;
  const view = credit.data.data;
  const currency = view.currency ?? '';
  const balances = view.balances ?? {};
  const instalmentLoan = kind === 'loan' && !isLine(view.product);
  const back = () =>
    kind === 'loan'
      ? navigate({ to: '/credit/loans/$loanId', params: { loanId: id } })
      : navigate({ to: '/credit/pay-later/$agreementId', params: { agreementId: id } });

  const due: Fact[] = [
    ...(balances.principalOutstanding === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.owed),
            value: <MaybeMoney amount={balances.principalOutstanding} currency={currency} />,
          },
        ]),
    ...(['principalDue', 'interestDue', 'feesDue'] as const).flatMap((key) =>
      balances[key] === undefined
        ? []
        : [
            {
              label: intl.formatMessage(messages[key]),
              value: <MaybeMoney amount={balances[key]} currency={currency} />,
            },
          ],
    ),
  ];

  const toReview = () => {
    const parsed = parseMoneyInput(amountText, currency, intl.locale);
    setProblem(parsed.ok ? undefined : parsed.problem);
    if (parsed.ok) flow.review({ mode: instalmentLoan ? mode : 'REGULAR', amount: parsed.amount, currency });
  };

  const body = flow.body;
  const steps = [messages.stepDetails, messages.stepReview, messages.stepDone].map((m) => intl.formatMessage(m));
  const done = flow.state.status === 'succeeded' ? (flow.state.data as RepaidView) : undefined;
  const paid = done?.repayment ?? done;

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Wizard steps={steps} current={flow.step === 'details' ? 0 : flow.step === 'review' ? 1 : 2}>
        {flow.step === 'details' ? (
          <Stack>
            {due.length === 0 ? null : <Facts rows={due} />}
            {instalmentLoan ? (
              <Radio.Group
                label={intl.formatMessage(messages.mode)}
                value={mode}
                onChange={(value) => setMode(value === 'EXTRA' ? 'EXTRA' : 'REGULAR')}
              >
                <Group mt="xs">
                  <Radio value="REGULAR" label={intl.formatMessage(messages.regular)} />
                  <Radio value="EXTRA" label={intl.formatMessage(messages.extra)} />
                </Group>
              </Radio.Group>
            ) : null}
            {mode === 'EXTRA' && instalmentLoan ? (
              <Text size="sm">
                <FormattedMessage {...messages.extraHint} />
              </Text>
            ) : null}
            <MoneyInput
              label={intl.formatMessage(messages.amount)}
              value={amountText}
              onChange={setAmountText}
              currency={currency}
              problem={problem}
            />
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
              ...(instalmentLoan
                ? [
                    {
                      label: intl.formatMessage(messages.mode),
                      value: intl.formatMessage(body.mode === 'EXTRA' ? messages.extra : messages.regular),
                    },
                  ]
                : []),
              { label: intl.formatMessage(messages.from), value: intl.formatMessage(messages.wallet) },
              {
                label: intl.formatMessage(messages.amount),
                value: <Money amount={body.amount} currency={body.currency} />,
                emphasis: true,
              },
            ]}
            notice={
              <Text size="sm">
                <FormattedMessage {...(online ? messages.notice : messages.offline)} />
              </Text>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={!online}
            onConfirm={async () => {
              await flow.confirm();
            }}
            onBack={flow.back}
          />
        ) : flow.state.status === 'succeeded' ? (
          <ResultPanel
            kind="succeeded"
            title={intl.formatMessage(messages.done)}
            correlationId={flow.state.correlationId}
            actions={
              <Button onClick={() => void back()}>
                <FormattedMessage {...(kind === 'loan' ? messages.backToLoan : messages.backToPlan)} />
              </Button>
            }
          >
            <MaybeMoney amount={paid?.amount} currency={paid?.currency ?? currency} />
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
      {done?.instalment === undefined ? null : (
        <Facts
          rows={[
            {
              label: intl.formatMessage(messages.newInstalment),
              value: <MaybeMoney amount={done.instalment} currency={currency} />,
              emphasis: true,
            },
            ...(done.nextDueDate === undefined
              ? []
              : [{ label: intl.formatMessage(messages.nextDue), value: <BusinessDate value={done.nextDueDate} /> }]),
            ...(done.remainingInstalments === undefined
              ? []
              : [
                  {
                    label: intl.formatMessage(messages.remaining),
                    value: String(done.remainingInstalments),
                  },
                ]),
          ]}
        />
      )}
      {flow.step === 'details' ? (
        kind === 'loan' ? (
          <Link to="/credit/loans/$loanId" params={{ loanId: id }}>
            <FormattedMessage {...messages.backToLoan} />
          </Link>
        ) : (
          <Link to="/credit/pay-later/$agreementId" params={{ agreementId: id }}>
            <FormattedMessage {...messages.backToPlan} />
          </Link>
        )
      ) : null}
    </Stack>
  );
}

export const LoanRepayPage = () => <RepayPage kind="loan" />;
export const BnplRepayPage = () => <RepayPage kind="bnpl" />;
