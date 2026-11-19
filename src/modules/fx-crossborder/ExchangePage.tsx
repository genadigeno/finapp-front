// Exchange currencies (P18-TSK-025; blueprint §4.5): the customer asks for a quote, reads it - what they pay, what
// they get, the rate and the margin finapp builds into it - and confirms before it expires. Every figure is finapp's;
// the countdown runs on finapp's clock and at zero the confirm control disables (ADR-F05 decision 7). Converting is
// final and immediate. Leaving a quote cancels it, so it does not count against the customer's open quotes.
import { Button, Group, Radio, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Countdown, Money, MoneyInput, Rate } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { FX_ROOT, usePairs } from './api.ts';
import { fractionToPercent } from './labels.ts';

const messages = defineMessages({
  title: { id: 'fx.title', defaultMessage: 'Exchange currencies' },
  stepDetails: { id: 'fx.step.details', defaultMessage: 'Amount' },
  stepQuote: { id: 'fx.step.quote', defaultMessage: 'Quote' },
  stepDone: { id: 'fx.step.done', defaultMessage: 'Done' },
  from: { id: 'fx.from', defaultMessage: 'From' },
  to: { id: 'fx.to', defaultMessage: 'To' },
  fixed: { id: 'fx.fixed', defaultMessage: 'I know the amount I want to' },
  fixedSource: { id: 'fx.fixed.source', defaultMessage: 'exchange' },
  fixedDestination: { id: 'fx.fixed.destination', defaultMessage: 'receive' },
  amount: { id: 'fx.amount', defaultMessage: 'Amount' },
  quote: { id: 'fx.getQuote', defaultMessage: 'Get a quote' },
  chooseFrom: { id: 'fx.chooseFrom', defaultMessage: 'Choose the currency to exchange.' },
  chooseTo: { id: 'fx.chooseTo', defaultMessage: 'Choose the currency to receive.' },
  noPairs: { id: 'fx.noPairs', defaultMessage: 'Currency exchange is not available right now' },
  reviewTitle: { id: 'fx.review', defaultMessage: 'Your quote' },
  pay: { id: 'fx.pay', defaultMessage: 'You exchange' },
  get: { id: 'fx.get', defaultMessage: 'You receive' },
  rate: { id: 'fx.rate', defaultMessage: 'Rate' },
  confirm: { id: 'fx.confirm', defaultMessage: 'Exchange now' },
  expired: { id: 'fx.expired', defaultMessage: 'This quote has expired. Get a new one to see the current rate.' },
  requote: { id: 'fx.requote', defaultMessage: 'Get a new quote' },
  offline: { id: 'fx.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  final: { id: 'fx.final', defaultMessage: 'Exchanging is immediate and cannot be undone.' },
  done: { id: 'fx.done', defaultMessage: 'Exchanged' },
  doneBody: { id: 'fx.done.body', defaultMessage: 'The money is in your wallet.' },
  accounts: { id: 'fx.accounts', defaultMessage: 'See your accounts' },
  another: { id: 'fx.another', defaultMessage: 'Exchange more' },
  quoting: { id: 'fx.quoting', defaultMessage: 'Getting your quote…' },
  exchanging: { id: 'fx.exchanging', defaultMessage: 'Exchanging…' },
  back: { id: 'fx.back', defaultMessage: 'Back to Move money' },
});

const marginMessage = defineMessage<{ percent: string }>({
  id: 'fx.margin',
  defaultMessage: 'The rate includes our margin of {percent}% over the mid-market rate. No other fee.',
});
const boundsMessage = defineMessage<{ min: string; max: string }>({
  id: 'fx.bounds',
  defaultMessage: 'Between {min} and {max}.',
});

type FixedSide = 'FIXED_SOURCE' | 'FIXED_DESTINATION';

interface QuoteRequest {
  sourceCurrency: string;
  destinationCurrency: string;
  fixedSide: FixedSide;
  amount: string;
}

export function ExchangePage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const pairs = usePairs();
  const [source, setSource] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [fixedSide, setFixedSide] = useState<FixedSide>('FIXED_SOURCE');
  const [amountText, setAmountText] = useState('');
  const [problems, setProblems] = useState<{ source?: string; destination?: string; amount?: MoneyInputProblem }>({});
  const [expired, setExpired] = useState(false);

  const quote = useCommand(
    async (intent: IdempotencyIntent<QuoteRequest>) =>
      ok(api.POST('/v1/me/fx/quotes', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { routeId: '/exchange' },
  );
  const convert = useCommand(
    async (intent: IdempotencyIntent<{ quoteId: string }>) =>
      ok(api.POST('/v1/me/fx/conversions', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { invalidate: [ACCOUNTS_ROOT, FX_ROOT], routeId: '/exchange' },
  );
  const cancel = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) =>
      ok(
        api.POST('/v1/me/fx/quotes/{id}/cancellation', {
          params: { path: { id: intent.body.id }, header: intent.headers() },
        }),
      ),
    { routeId: '/exchange' },
  );

  const available = useMemo(() => (pairs.data ?? []).filter((p) => p.available), [pairs.data]);
  const sources = [...new Set(available.map((p) => p.sourceCurrency))];
  const destinations = available.filter((p) => p.sourceCurrency === source).map((p) => p.destinationCurrency);
  const pair = available.find((p) => p.sourceCurrency === source && p.destinationCurrency === destination);
  const fixedCurrency = fixedSide === 'FIXED_SOURCE' ? source : destination;

  if (pairs.isPending) return <LoadingState />;
  if (pairs.isError) return <ErrorExplained error={pairs.error} onRetry={() => void pairs.refetch()} />;
  if (available.length === 0) {
    return (
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <EmptyState title={intl.formatMessage(messages.noPairs)} />
      </Stack>
    );
  }

  const getQuote = async () => {
    const next: typeof problems = {};
    if (source === null) next.source = intl.formatMessage(messages.chooseFrom);
    if (destination === null || pair === undefined) next.destination = intl.formatMessage(messages.chooseTo);
    const parsed = parseMoneyInput(amountText, fixedCurrency ?? 'EUR', intl.locale);
    if (!parsed.ok) next.amount = parsed.problem;
    setProblems(next);
    if (source === null || destination === null || pair === undefined || !parsed.ok) return;
    setExpired(false);
    await quote.submit({ sourceCurrency: source, destinationCurrency: destination, fixedSide, amount: parsed.amount });
  };

  const leaveQuote = (id: string | undefined) => {
    // Best effort: an unconfirmed quote is cancelled so it does not hold one of the customer's open-quote places.
    if (id !== undefined && !expired) void cancel.submit({ id });
    quote.discard();
    convert.discard();
    setExpired(false);
  };

  const issued = quote.state.status === 'succeeded' ? quote.state.data : undefined;
  const quoteFailure = failureOf(quote.state);
  const convertFailure = failureOf(convert.state);
  const step = convert.state.status !== 'idle' ? 2 : issued !== undefined ? 1 : 0;
  const steps = [messages.stepDetails, messages.stepQuote, messages.stepDone].map((m) => intl.formatMessage(m));
  const bounds =
    pair === undefined
      ? undefined
      : fixedSide === 'FIXED_SOURCE'
        ? { min: pair.sourceMinimum, max: pair.sourceMaximum, currency: pair.sourceCurrency }
        : { min: pair.destinationMinimum, max: pair.destinationMaximum, currency: pair.destinationCurrency };

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Wizard steps={steps} current={step}>
        {step === 0 ? (
          <Stack>
            <Group grow align="flex-start" wrap="wrap">
              <Select
                label={intl.formatMessage(messages.from)}
                data={sources}
                value={source}
                onChange={(value) => {
                  setSource(value);
                  setDestination(null);
                }}
                error={problems.source}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
              />
              <Select
                label={intl.formatMessage(messages.to)}
                data={destinations}
                value={destination}
                onChange={setDestination}
                error={problems.destination}
                allowDeselect={false}
                disabled={source === null}
                comboboxProps={{ withinPortal: false }}
              />
            </Group>
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
              description={
                bounds?.min === undefined || bounds.max === undefined
                  ? undefined
                  : intl.formatMessage(boundsMessage, { min: bounds.min, max: bounds.max })
              }
              value={amountText}
              onChange={setAmountText}
              currency={fixedCurrency ?? '---'}
              problem={problems.amount}
            />
            {quoteFailure === undefined ? null : <ErrorExplained error={quoteFailure.error} />}
            <div>
              <Button onClick={() => void getQuote()} loading={quote.state.status === 'sending'} disabled={!online}>
                <FormattedMessage {...messages.quote} />
              </Button>
            </div>
            {quote.state.status === 'sending' ? <LoadingState label={intl.formatMessage(messages.quoting)} /> : null}
          </Stack>
        ) : step === 1 && issued !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.reviewTitle)}
            rows={[
              {
                label: intl.formatMessage(messages.pay),
                value: <Money amount={issued.sourceAmount ?? ''} currency={issued.sourceCurrency ?? ''} />,
                emphasis: true,
              },
              {
                label: intl.formatMessage(messages.get),
                value: <Money amount={issued.destinationAmount ?? ''} currency={issued.destinationCurrency ?? ''} />,
                emphasis: true,
              },
              {
                label: intl.formatMessage(messages.rate),
                value: (
                  <Rate
                    rate={issued.customerRate ?? ''}
                    source={issued.sourceCurrency ?? ''}
                    destination={issued.destinationCurrency ?? ''}
                  />
                ),
              },
            ]}
            notice={
              <Stack gap={6}>
                {issued.disclosedMarginOverMid === undefined ? null : (
                  <Text size="sm">
                    {intl.formatMessage(marginMessage, {
                      percent: fractionToPercent(issued.disclosedMarginOverMid) ?? issued.disclosedMarginOverMid,
                    })}
                  </Text>
                )}
                {issued.expiresAt === undefined ? null : (
                  <Countdown expiresAt={issued.expiresAt} onExpire={() => setExpired(true)} />
                )}
                <Text size="sm">
                  <FormattedMessage {...(online ? (expired ? messages.expired : messages.final) : messages.offline)} />
                </Text>
                {expired ? (
                  <div>
                    <Button variant="default" onClick={() => leaveQuote(issued.id)}>
                      <FormattedMessage {...messages.requote} />
                    </Button>
                  </div>
                ) : null}
              </Stack>
            }
            confirmLabel={intl.formatMessage(messages.confirm)}
            confirmDisabled={expired || !online || issued.id === undefined}
            onConfirm={async () => {
              if (issued.id !== undefined) await convert.submit({ quoteId: issued.id });
            }}
            onBack={() => leaveQuote(issued.id)}
          />
        ) : convert.state.status === 'succeeded' ? (
          <ResultPanel
            kind="succeeded"
            title={intl.formatMessage(messages.done)}
            correlationId={convert.state.correlationId}
            actions={
              <>
                <Button onClick={() => void navigate({ to: '/accounts' })}>
                  <FormattedMessage {...messages.accounts} />
                </Button>
                <Button variant="default" onClick={() => leaveQuote(undefined)}>
                  <FormattedMessage {...messages.another} />
                </Button>
              </>
            }
          >
            <Money
              amount={convert.state.data.destinationAmount ?? ''}
              currency={convert.state.data.destinationCurrency ?? ''}
            />{' '}
            <FormattedMessage {...messages.doneBody} />
          </ResultPanel>
        ) : convertFailure !== undefined ? (
          <CommandOutcome
            state={convertFailure}
            onChange={() => leaveQuote(issued?.id)}
            onCheck={() => void navigate({ to: '/accounts' })}
            onSendSame={() => {
              if (issued?.id !== undefined) void convert.submit({ quoteId: issued.id });
            }}
          />
        ) : (
          <LoadingState label={intl.formatMessage(messages.exchanging)} />
        )}
      </Wizard>
      <Link to="/move">
        <FormattedMessage {...messages.back} />
      </Link>
    </Stack>
  );
}
