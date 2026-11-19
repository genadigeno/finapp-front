// Pay off in full (P18-TSK-029, -030): finapp quotes what it takes to close the loan or plan today - every part of
// it, and any refund - and the customer pays that quote from their wallet. A quote that went out of date (a payment
// or a day's interest moved it) is refused as stale: the customer asks for a new one, nothing is taken.
import { Button, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { BusinessDate } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT, type CreditKind } from './api.ts';
import { MaybeMoney, type Fact } from './CreditParts.tsx';

const messages = defineMessages({
  title: { id: 'payoff.title', defaultMessage: 'Pay off in full' },
  intro: {
    id: 'payoff.intro',
    defaultMessage: 'We work out exactly what it takes to close it today, including any interest built up so far.',
  },
  stepQuote: { id: 'payoff.step.quote', defaultMessage: 'Amount' },
  stepReview: { id: 'payoff.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'payoff.step.done', defaultMessage: 'Done' },
  getQuote: { id: 'payoff.getQuote', defaultMessage: 'Get my payoff amount' },
  quoting: { id: 'payoff.quoting', defaultMessage: 'Working it out…' },
  review: { id: 'payoff.review', defaultMessage: 'Your payoff amount' },
  amount: { id: 'payoff.amount', defaultMessage: 'You pay' },
  refund: { id: 'payoff.refund', defaultMessage: 'We refund you' },
  principal: { id: 'payoff.principal', defaultMessage: 'Borrowed amount' },
  interestDue: { id: 'payoff.interestDue', defaultMessage: 'Interest due' },
  interestAccrued: { id: 'payoff.interestAccrued', defaultMessage: 'Interest built up so far' },
  projectedInterest: { id: 'payoff.projectedInterest', defaultMessage: 'Interest up to the payoff date' },
  feesDue: { id: 'payoff.feesDue', defaultMessage: 'Fees due' },
  credit: { id: 'payoff.credit', defaultMessage: 'Already in your favour' },
  goodThrough: { id: 'payoff.goodThrough', defaultMessage: 'Valid for payment on' },
  confirm: { id: 'payoff.confirm', defaultMessage: 'Pay off now' },
  notice: {
    id: 'payoff.notice',
    defaultMessage:
      'The money leaves your wallet now and this closes. We will ask for the code from your authenticator app.',
  },
  offline: { id: 'payoff.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  paying: { id: 'payoff.paying', defaultMessage: 'Paying…' },
  done: { id: 'payoff.done', defaultMessage: 'Paid off' },
  doneBody: { id: 'payoff.done.body', defaultMessage: 'It is closed. Nothing more is owed.' },
  backToLoan: { id: 'repay.backToLoan', defaultMessage: 'Back to your loan' },
  backToPlan: { id: 'repay.backToPlan', defaultMessage: 'Back to your plan' },
});

interface QuoteView {
  quoteId?: string;
  currency?: string;
  amount?: string;
  refund?: string;
  principal?: string;
  interestDue?: string;
  interestAccrued?: string;
  projectedInterest?: string;
  feesDue?: string;
  creditBalance?: string;
  goodThrough?: string;
}

interface PayoffView {
  currency?: string;
  paid?: string;
  refunded?: string;
}

/** A positive decimal string (finapp sends "0.00" for a part that is nothing). */
const nonZero = (value: string | undefined): value is string => value !== undefined && /[1-9]/.test(value);

export function PayoffPage({ kind }: { kind: CreditKind }) {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const params = useParams({ strict: false }) as { loanId?: string; agreementId?: string };
  const id = (kind === 'loan' ? params.loanId : params.agreementId) ?? '';
  const routeId = kind === 'loan' ? '/credit/loans/$loanId/payoff' : '/credit/pay-later/$agreementId/payoff';

  const quote = useCommand(
    async (intent: IdempotencyIntent<Record<string, never>>) => {
      const init = { body: {}, params: { path: { id }, header: intent.headers() } };
      return kind === 'loan'
        ? ok(api.POST('/v1/me/loans/{id}/payoff-quotes', init))
        : ok(api.POST('/v1/me/bnpl-agreements/{id}/payoff-quotes', init));
    },
    { routeId },
  );
  const payoff = useCommand(
    async (intent: IdempotencyIntent<{ quoteId: string }>) => {
      const init = { body: { ...intent.body }, params: { path: { id }, header: intent.headers() } };
      return kind === 'loan'
        ? ok(api.POST('/v1/me/loans/{id}/payoff', init))
        : ok(api.POST('/v1/me/bnpl-agreements/{id}/payoff', init));
    },
    { invalidate: [CREDIT_ROOT, ACCOUNTS_ROOT], routeId },
  );

  const back = () =>
    kind === 'loan'
      ? navigate({ to: '/credit/loans/$loanId', params: { loanId: id } })
      : navigate({ to: '/credit/pay-later/$agreementId', params: { agreementId: id } });
  const requote = () => {
    payoff.discard();
    quote.discard();
  };

  const quoted = quote.state.status === 'succeeded' ? (quote.state.data as QuoteView) : undefined;
  const quoteFailure = failureOf(quote.state);
  const payoffFailure = failureOf(payoff.state);
  const step = payoff.state.status !== 'idle' ? 2 : quoted !== undefined ? 1 : 0;
  const steps = [messages.stepQuote, messages.stepReview, messages.stepDone].map((m) => intl.formatMessage(m));
  const currency = quoted?.currency ?? '';

  const row = (label: keyof typeof messages, amount: string | undefined, emphasis = false): Fact[] =>
    nonZero(amount)
      ? [
          {
            label: intl.formatMessage(messages[label]),
            value: <MaybeMoney amount={amount} currency={currency} />,
            emphasis,
          },
        ]
      : [];

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Wizard steps={steps} current={step}>
        {step === 0 ? (
          <Stack>
            <Text>
              <FormattedMessage {...messages.intro} />
            </Text>
            {quoteFailure === undefined ? null : <ErrorExplained error={quoteFailure.error} />}
            <div>
              <Button
                onClick={() => void quote.submit({})}
                loading={quote.state.status === 'sending'}
                disabled={!online}
              >
                <FormattedMessage {...messages.getQuote} />
              </Button>
            </div>
            {quote.state.status === 'sending' ? <LoadingState label={intl.formatMessage(messages.quoting)} /> : null}
          </Stack>
        ) : step === 1 && quoted !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.review)}
            rows={[
              {
                label: intl.formatMessage(messages.amount),
                value: <MaybeMoney amount={quoted.amount ?? '0'} currency={currency} />,
                emphasis: true,
              },
              ...row('refund', quoted.refund, true),
              ...row('principal', quoted.principal),
              ...row('interestDue', quoted.interestDue),
              ...row('interestAccrued', quoted.interestAccrued),
              ...row('projectedInterest', quoted.projectedInterest),
              ...row('feesDue', quoted.feesDue),
              ...row('credit', quoted.creditBalance),
              ...(quoted.goodThrough === undefined
                ? []
                : [
                    {
                      label: intl.formatMessage(messages.goodThrough),
                      value: <BusinessDate value={quoted.goodThrough} />,
                    },
                  ]),
            ]}
            notice={
              <Text size="sm">
                <FormattedMessage {...(online ? messages.notice : messages.offline)} />
              </Text>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={!online || quoted.quoteId === undefined}
            onConfirm={async () => {
              if (quoted.quoteId !== undefined) await payoff.submit({ quoteId: quoted.quoteId });
            }}
            onBack={requote}
          />
        ) : payoff.state.status === 'succeeded' ? (
          <ResultPanel
            kind="succeeded"
            title={intl.formatMessage(messages.done)}
            correlationId={payoff.state.correlationId}
            actions={
              <Button onClick={() => void back()}>
                <FormattedMessage {...(kind === 'loan' ? messages.backToLoan : messages.backToPlan)} />
              </Button>
            }
          >
            <MaybeMoney
              amount={(payoff.state.data as PayoffView).paid}
              currency={(payoff.state.data as PayoffView).currency ?? currency}
            />{' '}
            <FormattedMessage {...messages.doneBody} />
          </ResultPanel>
        ) : payoffFailure !== undefined ? (
          <CommandOutcome
            state={payoffFailure}
            onChange={requote}
            onCheck={() => void back()}
            onSendSame={() => {
              if (quoted?.quoteId !== undefined) void payoff.submit({ quoteId: quoted.quoteId });
            }}
          />
        ) : (
          <LoadingState label={intl.formatMessage(messages.paying)} />
        )}
      </Wizard>
      {step === 0 ? (
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

export const LoanPayoffPage = () => <PayoffPage kind="loan" />;
export const BnplPayoffPage = () => <PayoffPage kind="bnpl" />;
