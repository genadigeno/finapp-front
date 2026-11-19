// Withdraw to your bank (P18-TSK-024): from a wallet currency to the customer's own linked bank account, under the
// review's idempotency key. finapp may ask for the second factor first (step-up, then the same request again).
// finapp dispatches at once and the outcome follows: the withdrawal's status page follows it to the end.
import { Button, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { PocketSelect, pocketKey } from '../../design-system/PocketSelect.tsx';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Money, MoneyInput } from '../../design-system/Values.tsx';
import { ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { ACCOUNTS_ROOT, usePockets } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { usePaymentMethods } from '../../platform/customer/payment-methods.ts';

const messages = defineMessages({
  title: { id: 'withdraw.title', defaultMessage: 'Withdraw to your bank' },
  stepDetails: { id: 'withdraw.step.details', defaultMessage: 'Details' },
  stepReview: { id: 'withdraw.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'withdraw.step.done', defaultMessage: 'Sent' },
  from: { id: 'withdraw.from', defaultMessage: 'From' },
  to: { id: 'withdraw.to', defaultMessage: 'To your bank account' },
  amount: { id: 'withdraw.amount', defaultMessage: 'Amount' },
  continue: { id: 'withdraw.continue', defaultMessage: 'Continue' },
  confirm: { id: 'withdraw.confirm', defaultMessage: 'Withdraw now' },
  reviewTitle: { id: 'withdraw.review', defaultMessage: 'Check before you withdraw' },
  chooseFrom: { id: 'withdraw.chooseFrom', defaultMessage: 'Choose where the money comes from.' },
  chooseTo: { id: 'withdraw.chooseTo', defaultMessage: 'Choose your bank account.' },
  noBank: { id: 'withdraw.noBank', defaultMessage: 'You have no bank account to withdraw to.' },
  methods: { id: 'withdraw.methods', defaultMessage: 'Cards and bank accounts' },
  noWallet: { id: 'withdraw.noWallet', defaultMessage: 'You need a wallet with money in it to withdraw.' },
  accounts: { id: 'withdraw.accounts', defaultMessage: 'Go to your accounts' },
  notice: {
    id: 'withdraw.notice',
    defaultMessage: 'The money leaves your wallet now. No fee is charged. Your bank decides when it arrives.',
  },
  offline: { id: 'withdraw.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'withdraw.sending', defaultMessage: 'Sending…' },
});

interface WithdrawalRequest {
  paymentMethodId: string;
  amount: string;
  currency: string;
}

export function WithdrawPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const methods = usePaymentMethods();
  const pockets = usePockets();
  const [method, setMethod] = useState<string | null>(null);
  const [pocket, setPocket] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [problems, setProblems] = useState<{ method?: string; pocket?: string; amount?: MoneyInputProblem }>({});

  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<WithdrawalRequest>) =>
      ok(api.POST('/v1/me/withdrawals', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { invalidate: [ACCOUNTS_ROOT], routeId: '/move/withdraw' },
  );

  const dispatchedId = flow.state.status === 'succeeded' ? flow.state.data.id : undefined;
  useEffect(() => {
    if (dispatchedId !== undefined) {
      void navigate({ to: '/move/withdrawals/$withdrawalId', params: { withdrawalId: dispatchedId } });
    }
  }, [dispatchedId, navigate]);

  if (methods.isPending || pockets.isPending) return <LoadingState />;
  if (methods.isError) return <ErrorExplained error={methods.error} onRetry={() => void methods.refetch()} />;
  if (pockets.error !== null) return <ErrorExplained error={pockets.error} onRetry={pockets.refetch} />;

  // Only a bank account can receive a withdrawal (finapp refuses a card).
  const banks = methods.data.filter((m) => m.kind === 'BANK_ACCOUNT');
  if (banks.length === 0 || pockets.pockets.length === 0) {
    const noBank = banks.length === 0;
    return (
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <EmptyState title={intl.formatMessage(noBank ? messages.noBank : messages.noWallet)}>
          <Link to={noBank ? '/move/payment-methods' : '/accounts'}>
            <FormattedMessage {...(noBank ? messages.methods : messages.accounts)} />
          </Link>
        </EmptyState>
      </Stack>
    );
  }

  const chosenPocket = pockets.pockets.find((p) => pocketKey(p) === pocket);
  const chosenBank = banks.find((m) => m.id === method);
  const bankLabel = (id: string | undefined) => {
    const found = banks.find((m) => m.id === id);
    return found === undefined ? '' : `${found.brand ?? ''} •••• ${found.displaySuffix ?? ''}`.trim();
  };

  const toReview = () => {
    const next: typeof problems = {};
    if (chosenPocket === undefined) next.pocket = intl.formatMessage(messages.chooseFrom);
    if (chosenBank === undefined) next.method = intl.formatMessage(messages.chooseTo);
    const parsed = parseMoneyInput(amountText, chosenPocket?.currency ?? 'EUR', intl.locale);
    if (!parsed.ok) next.amount = parsed.problem;
    setProblems(next);
    if (chosenPocket === undefined || chosenBank === undefined || !parsed.ok) return;
    flow.review({ paymentMethodId: chosenBank.id, amount: parsed.amount, currency: chosenPocket.currency });
  };

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
            <PocketSelect
              label={intl.formatMessage(messages.from)}
              pockets={pockets.pockets}
              value={pocket}
              onChange={setPocket}
              error={problems.pocket}
            />
            <Select
              label={intl.formatMessage(messages.to)}
              data={banks.map((m) => ({ value: m.id, label: bankLabel(m.id) }))}
              value={method}
              onChange={setMethod}
              error={problems.method}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
            />
            <MoneyInput
              label={intl.formatMessage(messages.amount)}
              value={amountText}
              onChange={setAmountText}
              currency={chosenPocket?.currency ?? '---'}
              problem={problems.amount}
            />
            <div>
              <Button onClick={toReview}>
                <FormattedMessage {...messages.continue} />
              </Button>
            </div>
          </Stack>
        ) : flow.step === 'review' && body !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.reviewTitle)}
            rows={[
              { label: intl.formatMessage(messages.from), value: body.currency },
              { label: intl.formatMessage(messages.to), value: bankLabel(body.paymentMethodId) },
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
        ) : flow.state.status === 'refused' || flow.state.status === 'unknown' ? (
          <CommandOutcome state={flow.state} onChange={flow.back} onSendSame={() => void flow.confirm()} />
        ) : (
          <LoadingState label={intl.formatMessage(messages.sending)} />
        )}
      </Wizard>
    </Stack>
  );
}
