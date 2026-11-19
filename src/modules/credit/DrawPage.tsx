// Draw from a credit line (P18-TSK-029): money from the line into the customer's wallet, up to the available
// limit finapp states. finapp asks for the second factor every time.
import { Button, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Money, MoneyInput } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT, useLoan } from './api.ts';
import { Facts, MaybeMoney } from './CreditParts.tsx';

const messages = defineMessages({
  title: { id: 'draw.title', defaultMessage: 'Draw money' },
  stepDetails: { id: 'draw.step.details', defaultMessage: 'Amount' },
  stepReview: { id: 'draw.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'draw.step.done', defaultMessage: 'Done' },
  available: { id: 'loan.available', defaultMessage: 'Available to draw' },
  amount: { id: 'draw.amount', defaultMessage: 'Amount' },
  continue: { id: 'draw.continue', defaultMessage: 'Continue' },
  review: { id: 'draw.review', defaultMessage: 'Check your draw' },
  to: { id: 'draw.to', defaultMessage: 'Paid into' },
  wallet: { id: 'repay.wallet', defaultMessage: 'Your wallet' },
  confirm: { id: 'draw.confirm', defaultMessage: 'Draw now' },
  notice: {
    id: 'draw.notice',
    defaultMessage:
      'Interest is charged on what you draw from today. We will ask for the code from your authenticator app.',
  },
  offline: { id: 'draw.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'draw.sending', defaultMessage: 'Sending…' },
  done: { id: 'draw.done', defaultMessage: 'Money drawn' },
  doneBody: { id: 'draw.done.body', defaultMessage: 'It is in your wallet.' },
  backToLoan: { id: 'draw.backToLine', defaultMessage: 'Back to your credit line' },
});

interface Draw {
  amount: string;
  currency: string;
}

export function DrawPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const { loanId } = useParams({ strict: false }) as { loanId: string };
  const loan = useLoan(loanId);
  const [amountText, setAmountText] = useState('');
  const [problem, setProblem] = useState<MoneyInputProblem | undefined>();
  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<Draw>) =>
      ok(
        api.POST('/v1/me/loans/{id}/draws', {
          body: { ...intent.body },
          params: { path: { id: loanId }, header: intent.headers() },
        }),
      ),
    { invalidate: [CREDIT_ROOT, ACCOUNTS_ROOT], routeId: '/credit/loans/$loanId/draw' },
  );

  if (loan.isPending) return <LoadingState />;
  if (loan.isError) return <ErrorExplained error={loan.error} onRetry={() => void loan.refetch()} />;
  const view = loan.data.data;
  const currency = view.currency ?? '';
  const back = () => navigate({ to: '/credit/loans/$loanId', params: { loanId } });
  const body = flow.body;
  const steps = [messages.stepDetails, messages.stepReview, messages.stepDone].map((m) => intl.formatMessage(m));

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Wizard steps={steps} current={flow.step === 'details' ? 0 : flow.step === 'review' ? 1 : 2}>
        {flow.step === 'details' ? (
          <Stack>
            <Facts
              rows={[
                {
                  label: intl.formatMessage(messages.available),
                  value: <MaybeMoney amount={view.availableLimit} currency={currency} />,
                  emphasis: true,
                },
              ]}
            />
            <MoneyInput
              label={intl.formatMessage(messages.amount)}
              value={amountText}
              onChange={setAmountText}
              currency={currency}
              problem={problem}
            />
            <div>
              <Button
                onClick={() => {
                  const parsed = parseMoneyInput(amountText, currency, intl.locale);
                  setProblem(parsed.ok ? undefined : parsed.problem);
                  if (parsed.ok) flow.review({ amount: parsed.amount, currency });
                }}
              >
                <FormattedMessage {...messages.continue} />
              </Button>
            </div>
            <Link to="/credit/loans/$loanId" params={{ loanId }}>
              <FormattedMessage {...messages.backToLoan} />
            </Link>
          </Stack>
        ) : flow.step === 'review' && body !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.review)}
            rows={[
              {
                label: intl.formatMessage(messages.amount),
                value: <Money amount={body.amount} currency={body.currency} />,
                emphasis: true,
              },
              { label: intl.formatMessage(messages.to), value: intl.formatMessage(messages.wallet) },
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
                <FormattedMessage {...messages.backToLoan} />
              </Button>
            }
          >
            <MaybeMoney amount={flow.state.data.amount} currency={flow.state.data.currency ?? currency} />{' '}
            <FormattedMessage {...messages.doneBody} />
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
    </Stack>
  );
}
