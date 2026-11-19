// Send to someone at FinApp (P18-TSK-022; blueprint §4.3): details -> review -> outcome, one idempotency intent per
// review (ADR-F05). finapp settles a transfer in the same request: the answer is COMPLETED or FAILED, never
// pending. A risk check may ask for the second factor first (step-up, then the same request again).
//
// A failure says what the customer can act on (not enough money, a currency the recipient cannot hold); a risk or
// limit refusal says only that the transfer could not be completed (INV-RSK-08).
import { Button, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
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
import { useBeneficiaries } from './api.ts';

const messages = defineMessages({
  title: { id: 'send.title', defaultMessage: 'Send money' },
  stepDetails: { id: 'send.step.details', defaultMessage: 'Details' },
  stepReview: { id: 'send.step.review', defaultMessage: 'Review' },
  stepDone: { id: 'send.step.done', defaultMessage: 'Done' },
  from: { id: 'send.from', defaultMessage: 'From' },
  to: { id: 'send.to', defaultMessage: 'To' },
  amount: { id: 'send.amount', defaultMessage: 'Amount' },
  reference: { id: 'send.reference', defaultMessage: 'Reference (optional)' },
  referenceHint: { id: 'send.reference.hint', defaultMessage: 'The recipient sees this. At most 200 characters.' },
  continue: { id: 'send.continue', defaultMessage: 'Continue' },
  confirm: { id: 'send.confirm', defaultMessage: 'Send now' },
  chooseFrom: { id: 'send.chooseFrom', defaultMessage: 'Choose where the money comes from.' },
  chooseTo: { id: 'send.chooseTo', defaultMessage: 'Choose a recipient.' },
  referenceLong: { id: 'send.reference.long', defaultMessage: 'Use at most 200 characters.' },
  reviewTitle: { id: 'send.review.title', defaultMessage: 'Check before you send' },
  arrives: {
    id: 'send.arrives',
    defaultMessage: 'Money sent to another FinApp account arrives immediately and cannot be taken back by you.',
  },
  noWallet: { id: 'send.noWallet', defaultMessage: 'You need a wallet with money in it to send.' },
  openWallet: { id: 'send.openWallet', defaultMessage: 'Go to your accounts' },
  noRecipient: { id: 'send.noRecipient', defaultMessage: 'Add a recipient first.' },
  addRecipient: { id: 'send.addRecipient', defaultMessage: 'Add a recipient' },
  sent: { id: 'send.sent', defaultMessage: 'Money sent' },
  notSent: { id: 'send.notSent', defaultMessage: 'The money was not sent' },
  sendAnother: { id: 'send.another', defaultMessage: 'Send more' },
  activity: { id: 'send.activity', defaultMessage: 'See your activity' },
  offline: { id: 'send.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'send.sending', defaultMessage: 'Sending…' },
  // finapp's FailureReason, in words the customer can act on.
  INSUFFICIENT_FUNDS: {
    id: 'send.failure.funds',
    defaultMessage: 'There is not enough money available in this wallet.',
  },
  CURRENCY_MISMATCH: {
    id: 'send.failure.currency',
    defaultMessage: 'The recipient cannot receive this currency. Try another currency.',
  },
  SELF_TRANSFER: { id: 'send.failure.self', defaultMessage: 'You cannot send money to the account it comes from.' },
  NOT_POSTABLE: {
    id: 'send.failure.postable',
    defaultMessage: 'One of the accounts cannot send or receive money right now.',
  },
  GENERIC: {
    id: 'send.failure.generic',
    defaultMessage: 'This transfer could not be completed. Nothing was taken from your wallet.',
  },
});

const sentMessage = defineMessage<{ name: string }>({
  id: 'send.sentTo',
  defaultMessage: 'It has arrived in {name}’s account.',
});

/** finapp's failure reasons a customer can act on; every other reason - risk, limits - is generic (INV-RSK-08). */
export function failureWords(reason: string | undefined): MessageDescriptor {
  switch (reason) {
    case 'INSUFFICIENT_FUNDS':
      return messages.INSUFFICIENT_FUNDS;
    case 'CURRENCY_MISMATCH':
      return messages.CURRENCY_MISMATCH;
    case 'SELF_TRANSFER':
      return messages.SELF_TRANSFER;
    case 'SOURCE_NOT_POSTABLE':
    case 'DESTINATION_NOT_POSTABLE':
      return messages.NOT_POSTABLE;
    default:
      return messages.GENERIC;
  }
}

interface TransferRequest {
  sourceAccountId: string;
  beneficiaryId: string;
  amount: string;
  currency: string;
  reference?: string;
}

export function SendPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const pockets = usePockets();
  const recipients = useBeneficiaries();
  const requested = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)['to'] });

  const [pocket, setPocket] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string | null>(typeof requested === 'string' ? requested : null);
  const [amountText, setAmountText] = useState('');
  const [reference, setReference] = useState('');
  const [problems, setProblems] = useState<{
    pocket?: string;
    recipient?: string;
    amount?: MoneyInputProblem;
    reference?: string;
  }>({});

  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<TransferRequest>) =>
      ok(api.POST('/v1/transfers', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { invalidate: [ACCOUNTS_ROOT], routeId: '/move/send' },
  );

  if (pockets.isPending || recipients.isPending) return <LoadingState />;
  if (pockets.error !== null) return <ErrorExplained error={pockets.error} onRetry={pockets.refetch} />;
  if (recipients.isError) return <ErrorExplained error={recipients.error} onRetry={() => void recipients.refetch()} />;

  const chosenPocket = pockets.pockets.find((p) => pocketKey(p) === pocket);
  const known = recipients.data.find((r) => r.id === recipient);
  const steps = [messages.stepDetails, messages.stepReview, messages.stepDone].map((m) => intl.formatMessage(m));

  if (pockets.pockets.length === 0 || recipients.data.length === 0) {
    const noWallet = pockets.pockets.length === 0;
    return (
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <EmptyState title={intl.formatMessage(noWallet ? messages.noWallet : messages.noRecipient)}>
          <Link to={noWallet ? '/accounts' : '/move/recipients'}>
            <FormattedMessage {...(noWallet ? messages.openWallet : messages.addRecipient)} />
          </Link>
        </EmptyState>
      </Stack>
    );
  }

  const toReview = () => {
    const next: typeof problems = {};
    if (chosenPocket === undefined) next.pocket = intl.formatMessage(messages.chooseFrom);
    if (known === undefined) next.recipient = intl.formatMessage(messages.chooseTo);
    const parsed = parseMoneyInput(amountText, chosenPocket?.currency ?? 'EUR', intl.locale);
    if (!parsed.ok) next.amount = parsed.problem;
    if (reference.trim().length > 200) next.reference = intl.formatMessage(messages.referenceLong);
    setProblems(next);
    if (Object.keys(next).length > 0 || chosenPocket === undefined || known === undefined || !parsed.ok) return;
    flow.review({
      sourceAccountId: chosenPocket.accountId,
      beneficiaryId: known.id,
      amount: parsed.amount,
      currency: chosenPocket.currency,
      ...(reference.trim() === '' ? {} : { reference: reference.trim() }),
    });
  };

  const body = flow.body;
  const recipientOf = (id: string | undefined) => recipients.data.find((r) => r.id === id);

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
              data={recipients.data.map((r) => ({ value: r.id, label: r.displayName }))}
              value={recipient}
              onChange={setRecipient}
              error={problems.recipient}
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
            <TextInput
              label={intl.formatMessage(messages.reference)}
              description={intl.formatMessage(messages.referenceHint)}
              value={reference}
              onChange={(event) => setReference(event.currentTarget.value)}
              error={problems.reference}
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
              { label: intl.formatMessage(messages.from), value: `${body.currency}` },
              { label: intl.formatMessage(messages.to), value: recipientOf(body.beneficiaryId)?.displayName ?? '' },
              {
                label: intl.formatMessage(messages.amount),
                value: <Money amount={body.amount} currency={body.currency} />,
                emphasis: true,
              },
              ...(body.reference === undefined
                ? []
                : [{ label: intl.formatMessage(messages.reference), value: body.reference }]),
            ]}
            notice={
              <Text size="sm">
                {online ? <FormattedMessage {...messages.arrives} /> : <FormattedMessage {...messages.offline} />}
              </Text>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={!online}
            onConfirm={async () => {
              await flow.confirm();
            }}
            onBack={flow.back}
          />
        ) : flow.state.status === 'sending' || flow.state.status === 'idle' ? (
          <LoadingState label={intl.formatMessage(messages.sending)} />
        ) : flow.state.status === 'succeeded' && body !== undefined ? (
          flow.state.data.status === 'FAILED' ? (
            <ResultPanel
              kind="refused"
              title={intl.formatMessage(messages.notSent)}
              correlationId={flow.state.correlationId}
              actions={
                <Button variant="default" onClick={flow.back}>
                  <FormattedMessage {...messages.sendAnother} />
                </Button>
              }
            >
              {intl.formatMessage(failureWords(flow.state.data.failureReason))}
            </ResultPanel>
          ) : (
            <ResultPanel
              kind="succeeded"
              title={intl.formatMessage(messages.sent)}
              correlationId={flow.state.correlationId}
              actions={
                <>
                  <Button onClick={() => void navigate({ to: '/activity' })}>
                    <FormattedMessage {...messages.activity} />
                  </Button>
                  <Button variant="default" onClick={flow.back}>
                    <FormattedMessage {...messages.sendAnother} />
                  </Button>
                </>
              }
            >
              <Money amount={body.amount} currency={body.currency} />{' '}
              {intl.formatMessage(sentMessage, { name: recipientOf(body.beneficiaryId)?.displayName ?? '' })}
            </ResultPanel>
          )
        ) : flow.state.status === 'refused' || flow.state.status === 'unknown' ? (
          <CommandOutcome
            state={flow.state}
            onChange={flow.back}
            onCheck={() => void navigate({ to: '/activity' })}
            onSendSame={() => void flow.confirm()}
          />
        ) : null}
      </Wizard>
    </Stack>
  );
}
