// Add money (P18-TSK-023): top up a wallet from a saved card or bank account. finapp opens a payment (under the
// review's idempotency key) and the same request confirms it:
//   - a card answers at once: paid, declined, or - honestly - still processing;
//   - a bank account answers "processing" with a link where the customer approves the payment at their own bank.
// Anything still processing continues on the payment's status page, which follows finapp until it settles.
import { Button, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { PocketSelect, pocketKey } from '../../design-system/PocketSelect.tsx';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Money, MoneyInput } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { ACCOUNTS_ROOT, usePockets } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { usePaymentMethods } from '../../platform/customer/payment-methods.ts';
import { methodKind, topUpFailure } from './labels.ts';

const messages = defineMessages({
  title: { id: 'topUp.title', defaultMessage: 'Add money' },
  stepDetails: { id: 'topUp.step.details', defaultMessage: 'Details' },
  stepReview: { id: 'topUp.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'topUp.step.done', defaultMessage: 'Done' },
  method: { id: 'topUp.method', defaultMessage: 'Pay with' },
  into: { id: 'topUp.into', defaultMessage: 'Add to' },
  amount: { id: 'topUp.amount', defaultMessage: 'Amount' },
  continue: { id: 'topUp.continue', defaultMessage: 'Continue' },
  confirm: { id: 'topUp.confirm', defaultMessage: 'Pay now' },
  reviewTitle: { id: 'topUp.review', defaultMessage: 'Check before you pay' },
  chooseMethod: { id: 'topUp.chooseMethod', defaultMessage: 'Choose a card or bank account.' },
  chooseInto: { id: 'topUp.chooseInto', defaultMessage: 'Choose which currency to add.' },
  noMethod: { id: 'topUp.noMethod', defaultMessage: 'You have no card or bank account to pay with.' },
  methods: { id: 'topUp.methods', defaultMessage: 'Cards and bank accounts' },
  noWallet: { id: 'topUp.noWallet', defaultMessage: 'You need a wallet to add money to.' },
  accounts: { id: 'topUp.accounts', defaultMessage: 'Go to your accounts' },
  notice: { id: 'topUp.notice', defaultMessage: 'You will be charged this amount. No fee is added.' },
  offline: { id: 'topUp.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  paying: { id: 'topUp.paying', defaultMessage: 'Paying…' },
  paid: { id: 'topUp.paid', defaultMessage: 'Money added' },
  paidBody: { id: 'topUp.paid.body', defaultMessage: 'It is in your wallet now.' },
  failed: { id: 'topUp.failed', defaultMessage: 'The payment did not go through' },
  again: { id: 'topUp.again', defaultMessage: 'Try again' },
  status: { id: 'topUp.status', defaultMessage: 'See the payment' },
});

interface TopUpRequest {
  paymentMethodId: string;
  amount: string;
  currency: string;
}

export function TopUpPage() {
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
    async (intent: IdempotencyIntent<TopUpRequest>) => {
      // The payment is opened under the review's key - a re-send opens nothing new, it returns the same payment -
      // and confirming an opened payment converges, so the pair is safe to send again after an unknown outcome.
      const created = await ok(
        api.POST('/v1/payments', { body: { ...intent.body }, params: { header: intent.headers() } }),
      );
      const id = created.data.id;
      if (id === undefined) throw new Error('finapp opened a payment without an id.');
      return ok(api.POST('/v1/payments/{id}/confirmation', { params: { path: { id } } }));
    },
    { invalidate: [ACCOUNTS_ROOT], routeId: '/move/top-up' },
  );

  // Still processing (a bank approval, or an unknown card outcome): continue on the payment's own page.
  const processingId =
    flow.state.status === 'succeeded' && flow.state.data.status !== 'SUCCEEDED' && flow.state.data.status !== 'FAILED'
      ? flow.state.data.id
      : undefined;
  useEffect(() => {
    if (processingId !== undefined) {
      void navigate({ to: '/move/top-ups/$paymentId', params: { paymentId: processingId } });
    }
  }, [processingId, navigate]);

  if (methods.isPending || pockets.isPending) return <LoadingState />;
  if (methods.isError) return <ErrorExplained error={methods.error} onRetry={() => void methods.refetch()} />;
  if (pockets.error !== null) return <ErrorExplained error={pockets.error} onRetry={pockets.refetch} />;

  if (methods.data.length === 0 || pockets.pockets.length === 0) {
    const noMethod = methods.data.length === 0;
    return (
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <EmptyState title={intl.formatMessage(noMethod ? messages.noMethod : messages.noWallet)}>
          <Link to={noMethod ? '/move/payment-methods' : '/accounts'}>
            <FormattedMessage {...(noMethod ? messages.methods : messages.accounts)} />
          </Link>
        </EmptyState>
      </Stack>
    );
  }

  const chosenPocket = pockets.pockets.find((p) => pocketKey(p) === pocket);
  const chosenMethod = methods.data.find((m) => m.id === method);
  const methodLabel = (id: string | undefined) => {
    const found = methods.data.find((m) => m.id === id);
    if (found === undefined) return '';
    return `${found.brand ?? intl.formatMessage(methodKind(found.kind))}${found.displaySuffix === undefined ? '' : ` •••• ${found.displaySuffix}`}`;
  };

  const toReview = () => {
    const next: typeof problems = {};
    if (chosenMethod === undefined) next.method = intl.formatMessage(messages.chooseMethod);
    if (chosenPocket === undefined) next.pocket = intl.formatMessage(messages.chooseInto);
    const parsed = parseMoneyInput(amountText, chosenPocket?.currency ?? 'EUR', intl.locale);
    if (!parsed.ok) next.amount = parsed.problem;
    setProblems(next);
    if (chosenMethod === undefined || chosenPocket === undefined || !parsed.ok) return;
    flow.review({ paymentMethodId: chosenMethod.id, amount: parsed.amount, currency: chosenPocket.currency });
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
            <Select
              label={intl.formatMessage(messages.method)}
              data={methods.data.map((m) => ({ value: m.id, label: methodLabel(m.id) }))}
              value={method}
              onChange={setMethod}
              error={problems.method}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
            />
            <PocketSelect
              label={intl.formatMessage(messages.into)}
              pockets={pockets.pockets}
              value={pocket}
              onChange={setPocket}
              error={problems.pocket}
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
              { label: intl.formatMessage(messages.method), value: methodLabel(body.paymentMethodId) },
              { label: intl.formatMessage(messages.into), value: body.currency },
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
          <CommandOutcome
            state={flow.state}
            onChange={flow.back}
            onCheck={() => void navigate({ to: '/activity' })}
            onSendSame={() => void flow.confirm()}
          />
        ) : flow.state.status === 'succeeded' && body !== undefined && flow.state.data.status === 'SUCCEEDED' ? (
          <ResultPanel
            kind="succeeded"
            title={intl.formatMessage(messages.paid)}
            correlationId={flow.state.correlationId}
          >
            <Money amount={body.amount} currency={body.currency} /> <FormattedMessage {...messages.paidBody} />
          </ResultPanel>
        ) : flow.state.status === 'succeeded' && flow.state.data.status === 'FAILED' ? (
          <ResultPanel
            kind="refused"
            title={intl.formatMessage(messages.failed)}
            correlationId={flow.state.correlationId}
            actions={
              <Button variant="default" onClick={flow.back}>
                <FormattedMessage {...messages.again} />
              </Button>
            }
          >
            {intl.formatMessage(topUpFailure(flow.state.data.failureReason))}
          </ResultPanel>
        ) : (
          <LoadingState label={intl.formatMessage(messages.paying)} />
        )}
      </Wizard>
    </Stack>
  );
}
