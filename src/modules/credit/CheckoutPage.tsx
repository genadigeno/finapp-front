// Pay a shop (P18-TSK-031): the customer brings the checkout code the shop gave them and pays from their wallet, a
// saved card or bank account, or - where the shop offers it - pays later.
//
// The code is a bearer secret (finapp: it travels in a request body, never in a URL). It is typed in, held in this
// page's memory only, and never put in an address, storage or telemetry. finapp has no hand-over from a shop's site
// and no way back to it (G-20), and no read of the purchase before paying: the amount is shown once finapp answers.
// Confirming is safe to repeat - finapp continues the same payment rather than starting another - so "check again"
// asks finapp again with the same code.
import { Anchor, Button, Card, Radio, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { CHECKOUT_STATUS } from '../../design-system/status.ts';
import { Money, StatusChip } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { ApiError } from '../../platform/api/api-error.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { usePaymentMethods } from '../../platform/customer/payment-methods.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT } from './api.ts';
import { ConsentLink, MaybeMoney, useValueText } from './CreditParts.tsx';
import { CREDIT_CURRENCY, isHttpsLink, planName } from './labels.ts';

const messages = defineMessages({
  title: { id: 'checkout.title', defaultMessage: 'Pay a shop' },
  code: { id: 'checkout.code', defaultMessage: 'Checkout code' },
  codeHint: {
    id: 'checkout.codeHint',
    defaultMessage: 'The shop shows this code at its checkout. It is valid for 30 minutes and is never saved here.',
  },
  needCode: { id: 'checkout.needCode', defaultMessage: 'Enter the checkout code from the shop.' },
  continue: { id: 'checkout.continue', defaultMessage: 'Continue' },
  how: { id: 'checkout.how', defaultMessage: 'How do you want to pay?' },
  wallet: { id: 'checkout.wallet', defaultMessage: 'From my wallet' },
  later: { id: 'checkout.later', defaultMessage: 'Pay later' },
  amountUnknown: {
    id: 'checkout.amountUnknown',
    defaultMessage: 'Check the amount on the shop’s page before you pay. We show it once the payment is made.',
  },
  review: { id: 'checkout.review', defaultMessage: 'Pay the shop' },
  paying: { id: 'checkout.paying', defaultMessage: 'You pay with' },
  confirm: { id: 'checkout.confirm', defaultMessage: 'Pay now' },
  offline: { id: 'checkout.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'checkout.sending', defaultMessage: 'Paying…' },
  paid: { id: 'checkout.paid', defaultMessage: 'Paid' },
  paidBody: { id: 'checkout.paidBody', defaultMessage: 'You can return to the shop.' },
  pending: { id: 'checkout.pending', defaultMessage: 'Your payment is being processed' },
  pendingBody: {
    id: 'checkout.pendingBody',
    defaultMessage: 'If it does not go through, the shop will ask you to pay again. Nothing is taken twice.',
  },
  approve: { id: 'checkout.approve', defaultMessage: 'Approve at your bank' },
  checkAgain: { id: 'checkout.checkAgain', defaultMessage: 'Check again' },
  closed: { id: 'checkout.closed', defaultMessage: 'This checkout is closed' },
  closedBody: { id: 'checkout.closedBody', defaultMessage: 'Return to the shop and start again.' },
  plans: { id: 'checkout.plans', defaultMessage: 'Choose a plan' },
  apply: { id: 'checkout.apply', defaultMessage: 'Apply to pay later' },
  applyNotice: {
    id: 'checkout.applyNotice',
    defaultMessage: 'We check your credit history and send you an offer to read before anything is agreed.',
  },
  totalPayable: { id: 'offer.totalPayable', defaultMessage: 'Total to repay' },
  totalInterest: { id: 'offer.totalInterest', defaultMessage: 'Total interest' },
  back: { id: 'checkout.back', defaultMessage: 'Back to Credit' },
  startAgain: { id: 'checkout.startAgain', defaultMessage: 'Use another code' },
});

const planSummary = defineMessage<{ count: string; regular: string }>({
  id: 'checkout.planSummary',
  defaultMessage: '{count} payments of {regular}',
});
const methodLabel = defineMessage<{ brand: string; suffix: string }>({
  id: 'checkout.method',
  defaultMessage: '{brand} ending {suffix}',
});

interface Plan {
  product: string;
  plan: string;
  instalmentCount: number | undefined;
  regular: string | undefined;
  totalPayable: string | undefined;
  totalInterest: string | undefined;
}

type Choice = { kind: 'wallet' } | { kind: 'method'; id: string } | { kind: 'plan'; plan: Plan };

interface SessionView {
  status?: string;
  amount?: string;
  currency?: string;
  lineSummary?: string;
  authorizationHandle?: string;
}

const choiceKey = (choice: Choice) =>
  choice.kind === 'wallet' ? 'wallet' : choice.kind === 'method' ? `method:${choice.id}` : `plan:${choice.plan.plan}`;

export function CheckoutPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const methods = usePaymentMethods();
  const text = useValueText();
  const [codeText, setCodeText] = useState('');
  const [codeProblem, setCodeProblem] = useState<string | undefined>();
  // Held in memory only, for this visit.
  const [token, setToken] = useState<string | undefined>();
  const [round, setRound] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const options = useQuery({
    // The code is never part of a key: the round number stands for it.
    queryKey: [CREDIT_ROOT, 'checkout-options', round],
    queryFn: async (): Promise<Plan[]> => {
      try {
        const { data } = await ok(
          api.POST('/v1/checkout/sessions/bnpl-options', { body: { sessionToken: token ?? '' } }),
        );
        return (data.products ?? []).flatMap((product) =>
          (product.plans ?? []).flatMap((option) =>
            product.product === undefined || option.plan === undefined
              ? []
              : [
                  {
                    product: product.product,
                    plan: option.plan,
                    instalmentCount: option.illustration?.instalmentCount,
                    regular: option.illustration?.regularInstalment ?? option.illustration?.firstInstalment,
                    totalPayable: option.illustration?.totalPayable,
                    totalInterest: option.illustration?.totalInterest,
                  },
                ],
          ),
        );
      } catch (error) {
        // Pay later not offered for this purchase: the other ways to pay remain.
        if (error instanceof ApiError && error.code === 'bnpl.SessionNotEligible') return [];
        throw error;
      }
    },
    enabled: token !== undefined,
    gcTime: 0,
    retry: false,
  });

  const confirm = useCommand(
    // No idempotency key: finapp continues the same payment when the same code is confirmed again.
    async (intent: IdempotencyIntent<{ instrument?: 'WALLET'; paymentMethodId?: string }>) =>
      ok(
        api.POST('/v1/checkout/sessions/confirmation', {
          body: { sessionToken: token ?? '', ...intent.body },
        }),
      ),
    { invalidate: [ACCOUNTS_ROOT], routeId: '/checkout' },
  );
  const apply = useCommand(
    async (intent: IdempotencyIntent<{ product: string; plan: string }>) =>
      ok(
        api.POST('/v1/me/bnpl-applications', {
          body: { sessionToken: token ?? '', ...intent.body },
          params: { header: intent.headers() },
        }),
      ),
    { invalidate: [CREDIT_ROOT], routeId: '/checkout' },
  );

  const applicationId = apply.state.status === 'succeeded' ? apply.state.data.applicationId : undefined;
  useEffect(() => {
    if (applicationId !== undefined) {
      void navigate({ to: '/credit/pay-later/applications/$applicationId', params: { applicationId } });
    }
  }, [applicationId, navigate]);

  const startAgain = () => {
    setToken(undefined);
    setCodeText('');
    setChoice(null);
    setReviewing(false);
    confirm.discard();
    apply.discard();
  };

  const header = (
    <>
      <Link to="/credit">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
    </>
  );

  if (token === undefined) {
    return (
      <Stack gap="lg" maw={560}>
        {header}
        <TextInput
          label={intl.formatMessage(messages.code)}
          description={intl.formatMessage(messages.codeHint)}
          value={codeText}
          onChange={(event) => setCodeText(event.currentTarget.value)}
          error={codeProblem}
          autoComplete="off"
          spellCheck={false}
        />
        <div>
          <Button
            onClick={() => {
              const code = codeText.trim();
              setCodeProblem(code === '' ? intl.formatMessage(messages.needCode) : undefined);
              if (code === '') return;
              setToken(code);
              setCodeText('');
              setRound((value) => value + 1);
            }}
          >
            <FormattedMessage {...messages.continue} />
          </Button>
        </div>
      </Stack>
    );
  }

  if (options.isPending || methods.isPending) return <LoadingState />;
  if (options.isError) {
    return (
      <Stack gap="lg" maw={560}>
        {header}
        <ErrorExplained error={options.error} />
        <div>
          <Button variant="default" onClick={startAgain}>
            <FormattedMessage {...messages.startAgain} />
          </Button>
        </div>
      </Stack>
    );
  }

  const plans = options.data;
  const savedMethods = methods.data ?? [];
  const choices: Array<{ choice: Choice; label: string }> = [
    { choice: { kind: 'wallet' }, label: intl.formatMessage(messages.wallet) },
    ...savedMethods.map((method) => ({
      choice: { kind: 'method' as const, id: method.id },
      label: intl.formatMessage(methodLabel, { brand: method.brand ?? '', suffix: method.displaySuffix ?? '' }),
    })),
  ];
  const chosen = choices.find((entry) => choiceKey(entry.choice) === choice);
  const chosenPlan = plans.find((plan) => `plan:${plan.plan}` === choice);
  const session = confirm.state.status === 'succeeded' ? (confirm.state.data as SessionView) : undefined;
  const confirmFailure = failureOf(confirm.state);
  const applyFailure = failureOf(apply.state);
  const resend = () => {
    if (chosen === undefined) return;
    void confirm.submit(
      chosen.choice.kind === 'method' ? { paymentMethodId: chosen.choice.id } : { instrument: 'WALLET' },
    );
  };

  if (session !== undefined) {
    const status = session.status ?? '';
    const paid = status === 'COMPLETED' || status === 'COMPLETED_LATE';
    const closed = status === 'EXPIRED' || status === 'ABANDONED';
    return (
      <Stack gap="lg" maw={560}>
        {header}
        <ResultPanel
          kind={paid ? 'succeeded' : closed ? 'refused' : 'pending'}
          title={intl.formatMessage(paid ? messages.paid : closed ? messages.closed : messages.pending)}
          correlationId={confirm.state.status === 'succeeded' ? confirm.state.correlationId : undefined}
          actions={
            paid || closed ? undefined : (
              <>
                {isHttpsLink(session.authorizationHandle) ? (
                  <Button component="a" href={session.authorizationHandle} rel="noopener noreferrer">
                    <FormattedMessage {...messages.approve} />
                  </Button>
                ) : null}
                <Button variant="default" onClick={resend} loading={confirm.state.status === 'sending'}>
                  <FormattedMessage {...messages.checkAgain} />
                </Button>
              </>
            )
          }
        >
          <FormattedMessage {...(paid ? messages.paidBody : closed ? messages.closedBody : messages.pendingBody)} />
        </ResultPanel>
        <Card withBorder radius="md" padding="md">
          <Stack gap={4}>
            <StatusChip value={status} map={CHECKOUT_STATUS} />
            {session.lineSummary === undefined ? null : <Text>{session.lineSummary}</Text>}
            <MaybeMoney amount={session.amount} currency={session.currency} />
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" maw={560}>
      {header}
      {reviewing && chosen !== undefined ? (
        confirmFailure === undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.review)}
            rows={[{ label: intl.formatMessage(messages.paying), value: chosen.label, emphasis: true }]}
            notice={
              <Text size="sm">
                <FormattedMessage {...(online ? messages.amountUnknown : messages.offline)} />
              </Text>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={!online}
            onConfirm={async () => {
              await confirm.submit(
                chosen.choice.kind === 'method' ? { paymentMethodId: chosen.choice.id } : { instrument: 'WALLET' },
              );
            }}
            onBack={() => setReviewing(false)}
          />
        ) : (
          <Stack>
            <CommandOutcome
              state={confirmFailure}
              onChange={() => {
                confirm.discard();
                setReviewing(false);
              }}
              onSendSame={resend}
            />
            <div>
              <Button variant="default" onClick={startAgain}>
                <FormattedMessage {...messages.startAgain} />
              </Button>
            </div>
          </Stack>
        )
      ) : (
        <Stack>
          <Radio.Group label={intl.formatMessage(messages.how)} value={choice} onChange={setChoice}>
            <Stack mt="xs" gap={4}>
              {choices.map((entry) => (
                <Radio key={choiceKey(entry.choice)} value={choiceKey(entry.choice)} label={entry.label} />
              ))}
              {plans.map((plan) => {
                const name = planName(plan.plan);
                return (
                  <Radio
                    key={`plan:${plan.plan}`}
                    value={`plan:${plan.plan}`}
                    label={`${intl.formatMessage(messages.later)}: ${name === undefined ? plan.plan : intl.formatMessage(name)}`}
                  />
                );
              })}
            </Stack>
          </Radio.Group>
          {chosenPlan === undefined ? (
            <>
              <Text size="sm">
                <FormattedMessage {...messages.amountUnknown} />
              </Text>
              <div>
                <Button disabled={chosen === undefined} onClick={() => setReviewing(true)}>
                  <FormattedMessage {...messages.continue} />
                </Button>
              </div>
            </>
          ) : (
            <Card withBorder radius="md" padding="md">
              <Stack gap="xs">
                {chosenPlan.instalmentCount === undefined || chosenPlan.regular === undefined ? null : (
                  <Text fw={600}>
                    {intl.formatMessage(planSummary, {
                      count: String(chosenPlan.instalmentCount),
                      regular: text.money(chosenPlan.regular, CREDIT_CURRENCY),
                    })}
                  </Text>
                )}
                {chosenPlan.totalInterest === undefined ? null : (
                  <Text size="sm">
                    <FormattedMessage {...messages.totalInterest} />{' '}
                    <Money amount={chosenPlan.totalInterest} currency={CREDIT_CURRENCY} />
                  </Text>
                )}
                {chosenPlan.totalPayable === undefined ? null : (
                  <Text size="sm">
                    <FormattedMessage {...messages.totalPayable} />{' '}
                    <Money amount={chosenPlan.totalPayable} currency={CREDIT_CURRENCY} />
                  </Text>
                )}
                <Text size="sm">
                  <FormattedMessage {...messages.applyNotice} />
                </Text>
                {applyFailure === undefined ? null : (
                  <Stack gap="xs">
                    <ErrorExplained error={applyFailure.error} />
                    <ConsentLink error={applyFailure.error} />
                  </Stack>
                )}
                <div>
                  <Button
                    disabled={!online}
                    loading={apply.state.status === 'sending'}
                    onClick={() => void apply.submit({ product: chosenPlan.product, plan: chosenPlan.plan })}
                  >
                    <FormattedMessage {...messages.apply} />
                  </Button>
                </div>
              </Stack>
            </Card>
          )}
          <Anchor component="button" type="button" onClick={startAgain}>
            <FormattedMessage {...messages.startAgain} />
          </Anchor>
        </Stack>
      )}
    </Stack>
  );
}
