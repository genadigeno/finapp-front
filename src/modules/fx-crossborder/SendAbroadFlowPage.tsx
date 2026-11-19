// Paying an overseas recipient (P18-TSK-026; blueprint §4.4): amount -> quote -> payment. The quote shows, before
// anything is sent, what leaves the wallet (amount plus fee), what the recipient gets (guaranteed), the rate and the
// delivery estimate, with a countdown on finapp's clock. finapp may ask for the second factor before it accepts the
// payment (step-up, then the same request again). The payment then follows on its status page.
import { Button, Group, Radio, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Countdown, Money, MoneyInput, Rate } from '../../design-system/Values.tsx';
import { ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { useCorridors, useRecipients, XB_ROOT } from './api.ts';
import { fractionToPercent } from './labels.ts';
import { EstimateText } from './SendAbroadPage.tsx';

const messages = defineMessages({
  title: { id: 'xbSend.title', defaultMessage: 'Send abroad' },
  stepDetails: { id: 'xbSend.step.details', defaultMessage: 'Amount' },
  stepQuote: { id: 'xbSend.step.quote', defaultMessage: 'Quote' },
  stepSent: { id: 'xbSend.step.sent', defaultMessage: 'Sent' },
  recipient: { id: 'xbSend.recipient', defaultMessage: 'Recipient' },
  from: { id: 'xbSend.from', defaultMessage: 'Pay from your' },
  fixed: { id: 'xbSend.fixed', defaultMessage: 'I know the amount' },
  fixedSource: { id: 'xbSend.fixed.source', defaultMessage: 'I send' },
  fixedDestination: { id: 'xbSend.fixed.destination', defaultMessage: 'they receive' },
  amount: { id: 'xbSend.amount', defaultMessage: 'Amount' },
  quote: { id: 'xbSend.getQuote', defaultMessage: 'Get a quote' },
  chooseRecipient: { id: 'xbSend.chooseRecipient', defaultMessage: 'Choose a recipient.' },
  chooseFrom: { id: 'xbSend.chooseFrom', defaultMessage: 'Choose the currency to pay from.' },
  noRecipient: { id: 'xbSend.noRecipient', defaultMessage: 'You have no overseas recipient ready to pay' },
  recipients: { id: 'xbSend.recipients', defaultMessage: 'Your overseas recipients' },
  reviewTitle: { id: 'xbSend.review', defaultMessage: 'Your quote' },
  send: { id: 'xbSend.send', defaultMessage: 'You send' },
  fee: { id: 'xbSend.fee', defaultMessage: 'Fee' },
  total: { id: 'xbSend.total', defaultMessage: 'Total taken from your wallet' },
  receives: { id: 'xbSend.receives', defaultMessage: 'They receive' },
  rate: { id: 'xbSend.rate', defaultMessage: 'Rate' },
  confirm: { id: 'xbSend.confirm', defaultMessage: 'Send payment' },
  expired: {
    id: 'xbSend.expired',
    defaultMessage: 'This quote has expired. Get a new one to see the current rate and fee.',
  },
  requote: { id: 'xbSend.requote', defaultMessage: 'Get a new quote' },
  offline: { id: 'xbSend.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  guaranteed: { id: 'xbSend.guaranteed', defaultMessage: 'The amount they receive is guaranteed by this quote.' },
  sending: { id: 'xbSend.sending', defaultMessage: 'Sending…' },
  quoting: { id: 'xbSend.quoting', defaultMessage: 'Getting your quote…' },
  back: { id: 'xbSend.back', defaultMessage: 'Back to Send abroad' },
});

const marginMessage = defineMessage<{ percent: string }>({
  id: 'xbSend.margin',
  defaultMessage: 'The rate includes our margin of {percent}% over the mid-market rate.',
});

type FixedSide = 'FIXED_SOURCE' | 'FIXED_DESTINATION';

interface QuoteRequest {
  beneficiaryId: string;
  sourceCurrency: string;
  fixedSide: FixedSide;
  amount: string;
}

export function SendAbroadFlowPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const recipients = useRecipients();
  const corridors = useCorridors();
  const requested = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)['to'] });
  const [recipientId, setRecipientId] = useState<string | null>(typeof requested === 'string' ? requested : null);
  const [source, setSource] = useState<string | null>(null);
  const [fixedSide, setFixedSide] = useState<FixedSide>('FIXED_SOURCE');
  const [amountText, setAmountText] = useState('');
  const [problems, setProblems] = useState<{ recipient?: string; source?: string; amount?: MoneyInputProblem }>({});
  const [expired, setExpired] = useState(false);

  const quote = useCommand(
    async (intent: IdempotencyIntent<QuoteRequest>) =>
      ok(api.POST('/v1/me/cross-border/quotes', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { routeId: '/send-abroad/send' },
  );
  const pay = useCommand(
    async (intent: IdempotencyIntent<{ quoteId: string }>) =>
      ok(api.POST('/v1/me/cross-border/payments', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { invalidate: [ACCOUNTS_ROOT, XB_ROOT], routeId: '/send-abroad/send' },
  );

  const paymentId = pay.state.status === 'succeeded' ? pay.state.data.paymentId : undefined;
  useEffect(() => {
    if (paymentId !== undefined) {
      void navigate({ to: '/send-abroad/payments/$paymentId', params: { paymentId } });
    }
  }, [paymentId, navigate]);

  if (recipients.isPending || corridors.isPending) return <LoadingState />;
  if (recipients.isError) return <ErrorExplained error={recipients.error} onRetry={() => void recipients.refetch()} />;
  if (corridors.isError) return <ErrorExplained error={corridors.error} onRetry={() => void corridors.refetch()} />;

  const payable = recipients.data.recipients.filter((r) => r.status === 'ACTIVE');
  if (payable.length === 0) {
    return (
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <EmptyState title={intl.formatMessage(messages.noRecipient)}>
          <Link to="/send-abroad">
            <FormattedMessage {...messages.recipients} />
          </Link>
        </EmptyState>
      </Stack>
    );
  }

  const recipient = payable.find((r) => r.id === recipientId);
  // The currencies the customer can pay this recipient from: the corridors into the recipient's currency.
  const sources = [
    ...new Set(
      corridors.data
        .filter(
          (c) =>
            c.destination === recipient?.currency &&
            (recipient?.country === undefined || c.country === recipient.country),
        )
        .map((c) => c.source),
    ),
  ];
  const corridor = corridors.data.find(
    (c) => c.source === source && c.destination === recipient?.currency && c.country === recipient?.country,
  );
  const fixedCurrency = fixedSide === 'FIXED_SOURCE' ? source : (recipient?.currency ?? null);

  const getQuote = async () => {
    const next: typeof problems = {};
    if (recipient === undefined) next.recipient = intl.formatMessage(messages.chooseRecipient);
    if (source === null) next.source = intl.formatMessage(messages.chooseFrom);
    const parsed = parseMoneyInput(amountText, fixedCurrency ?? 'EUR', intl.locale);
    if (!parsed.ok) next.amount = parsed.problem;
    setProblems(next);
    if (recipient === undefined || source === null || !parsed.ok) return;
    setExpired(false);
    await quote.submit({ beneficiaryId: recipient.id, sourceCurrency: source, fixedSide, amount: parsed.amount });
  };

  const requote = () => {
    quote.discard();
    pay.discard();
    setExpired(false);
  };

  const offer = quote.state.status === 'succeeded' ? quote.state.data : undefined;
  const quoteFailure = failureOf(quote.state);
  const payFailure = failureOf(pay.state);
  const step = pay.state.status !== 'idle' ? 2 : offer !== undefined ? 1 : 0;
  const steps = [messages.stepDetails, messages.stepQuote, messages.stepSent].map((m) => intl.formatMessage(m));

  return (
    <Stack gap="lg" maw={560}>
      <Link to="/send-abroad">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Wizard steps={steps} current={step}>
        {step === 0 ? (
          <Stack>
            <Select
              label={intl.formatMessage(messages.recipient)}
              data={payable.map((r) => ({ value: r.id, label: `${r.nickname} (${r.currency ?? ''})` }))}
              value={recipientId}
              onChange={(value) => {
                setRecipientId(value);
                setSource(null);
              }}
              error={problems.recipient}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
            />
            <Select
              label={intl.formatMessage(messages.from)}
              data={sources}
              value={source}
              onChange={setSource}
              error={problems.source}
              disabled={recipient === undefined}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
            />
            <Radio.Group
              label={intl.formatMessage(messages.fixed)}
              value={fixedSide}
              onChange={(value) => setFixedSide(value === 'FIXED_DESTINATION' ? 'FIXED_DESTINATION' : 'FIXED_SOURCE')}
            >
              <Group mt="xs">
                <Radio value="FIXED_SOURCE" label={intl.formatMessage(messages.fixedSource)} />
                <Radio value="FIXED_DESTINATION" label={intl.formatMessage(messages.fixedDestination)} />
              </Group>
            </Radio.Group>
            <MoneyInput
              label={intl.formatMessage(messages.amount)}
              value={amountText}
              onChange={setAmountText}
              currency={fixedCurrency ?? '---'}
              problem={problems.amount}
            />
            {corridor === undefined ? null : <EstimateText hours={corridor.deliveryEstimateHours} />}
            {quoteFailure === undefined ? null : <ErrorExplained error={quoteFailure.error} />}
            <div>
              <Button onClick={() => void getQuote()} loading={quote.state.status === 'sending'} disabled={!online}>
                <FormattedMessage {...messages.quote} />
              </Button>
            </div>
            {quote.state.status === 'sending' ? <LoadingState label={intl.formatMessage(messages.quoting)} /> : null}
          </Stack>
        ) : step === 1 && offer !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.reviewTitle)}
            rows={[
              { label: intl.formatMessage(messages.recipient), value: recipient?.nickname ?? '' },
              {
                label: intl.formatMessage(messages.send),
                value: <Money amount={offer.sourceAmount ?? ''} currency={offer.sourceCurrency ?? ''} />,
              },
              {
                label: intl.formatMessage(messages.fee),
                value: <Money amount={offer.fee ?? ''} currency={offer.sourceCurrency ?? ''} />,
                emphasis: true,
              },
              {
                label: intl.formatMessage(messages.total),
                value: <Money amount={offer.totalDebit ?? ''} currency={offer.sourceCurrency ?? ''} />,
                emphasis: true,
              },
              {
                label: intl.formatMessage(messages.receives),
                value: <Money amount={offer.destinationAmount ?? ''} currency={offer.destinationCurrency ?? ''} />,
                emphasis: true,
              },
              {
                label: intl.formatMessage(messages.rate),
                value: (
                  <Rate
                    rate={offer.customerRate ?? ''}
                    source={offer.sourceCurrency ?? ''}
                    destination={offer.destinationCurrency ?? ''}
                  />
                ),
              },
            ]}
            notice={
              <Stack gap={6}>
                {offer.disclosedMarginOverMid === undefined ? null : (
                  <Text size="sm">
                    {intl.formatMessage(marginMessage, {
                      percent: fractionToPercent(offer.disclosedMarginOverMid) ?? offer.disclosedMarginOverMid,
                    })}
                  </Text>
                )}
                <Text size="sm">
                  <FormattedMessage {...messages.guaranteed} />
                </Text>
                <EstimateText hours={offer.deliveryEstimateHours} />
                {offer.expiresAt === undefined ? null : (
                  <Countdown expiresAt={offer.expiresAt} onExpire={() => setExpired(true)} />
                )}
                {expired || !online ? (
                  <Text size="sm">
                    <FormattedMessage {...(expired ? messages.expired : messages.offline)} />
                  </Text>
                ) : null}
                {expired ? (
                  <div>
                    <Button variant="default" onClick={requote}>
                      <FormattedMessage {...messages.requote} />
                    </Button>
                  </div>
                ) : null}
              </Stack>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={expired || !online || offer.id === undefined}
            onConfirm={async () => {
              if (offer.id !== undefined) await pay.submit({ quoteId: offer.id });
            }}
            onBack={requote}
          />
        ) : payFailure !== undefined ? (
          <CommandOutcome
            state={payFailure}
            onChange={requote}
            onSendSame={() => {
              if (offer?.id !== undefined) void pay.submit({ quoteId: offer.id });
            }}
          />
        ) : (
          <LoadingState label={intl.formatMessage(messages.sending)} />
        )}
      </Wizard>
    </Stack>
  );
}
