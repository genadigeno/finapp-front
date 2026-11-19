// Check what you could borrow (P18-TSK-028): a credit decision request for a loan or a credit line. finapp
// answers later (202): the request's own page follows it. finapp asks for the second factor every time, and for
// the customer's consent to check their credit history.
import { Button, Group, Radio, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { parseMoneyInput, type MoneyInputProblem } from '../../design-system/money.ts';
import { LoadingState } from '../../design-system/States.tsx';
import { Money, MoneyInput } from '../../design-system/Values.tsx';
import { ReviewPanel, Wizard } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { useReviewFlow } from '../../platform/api/use-review-flow.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT } from './api.ts';
import { ConsentLink } from './CreditParts.tsx';
import {
  APPLICABLE_PRODUCTS,
  CREDIT_CURRENCY,
  isLine,
  productName,
  TERM_CHOICES,
  type ApplicableProduct,
} from './labels.ts';

const messages = defineMessages({
  title: { id: 'creditCheck.title', defaultMessage: 'Check what you could borrow' },
  intro: {
    id: 'creditCheck.intro',
    defaultMessage: 'We look at your credit history and tell you what we could lend. Checking does not commit you.',
  },
  stepDetails: { id: 'creditCheck.step.details', defaultMessage: 'Details' },
  stepReview: { id: 'creditCheck.step.review', defaultMessage: 'Review' },
  stepSent: { id: 'creditCheck.step.sent', defaultMessage: 'Sent' },
  product: { id: 'creditCheck.product', defaultMessage: 'What would you like?' },
  amount: { id: 'creditCheck.amount', defaultMessage: 'How much?' },
  term: { id: 'creditCheck.term', defaultMessage: 'Over how many months?' },
  income: { id: 'creditCheck.income', defaultMessage: 'Your monthly income after tax (optional)' },
  expenditure: { id: 'creditCheck.expenditure', defaultMessage: 'Your monthly outgoings (optional)' },
  chooseTerm: { id: 'creditCheck.chooseTerm', defaultMessage: 'Choose how many months.' },
  continue: { id: 'creditCheck.continue', defaultMessage: 'Continue' },
  review: { id: 'creditCheck.review', defaultMessage: 'Check your request' },
  confirm: { id: 'creditCheck.confirm', defaultMessage: 'Send my request' },
  notice: {
    id: 'creditCheck.notice',
    defaultMessage: 'We will ask for the code from your authenticator app. The answer usually takes a few minutes.',
  },
  offline: { id: 'creditCheck.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  sending: { id: 'creditCheck.sending', defaultMessage: 'Sending…' },
  back: { id: 'creditCheck.back', defaultMessage: 'Back to Credit' },
});

const monthsMessage = defineMessage<{ months: string }>({ id: 'credit.months', defaultMessage: '{months} months' });

export interface CreditRequest {
  product: ApplicableProduct;
  amount: string;
  currency: string;
  termMonths?: number;
  declaredMonthlyIncome?: string;
  declaredMonthlyExpenditure?: string;
}

/** An optional amount: empty is fine, anything else must parse. */
export function optionalAmount(
  text: string,
  locale: string,
): { ok: true; amount: string | undefined } | { ok: false; problem: MoneyInputProblem } {
  if (text.trim() === '') return { ok: true, amount: undefined };
  const parsed = parseMoneyInput(text, CREDIT_CURRENCY, locale);
  return parsed.ok ? { ok: true, amount: parsed.amount } : parsed;
}

/** The fields a loan application and a credit check share. */
export function useCreditForm() {
  const intl = useIntl();
  const [product, setProduct] = useState<ApplicableProduct>('PERSONAL_LOAN');
  const [amountText, setAmountText] = useState('');
  const [term, setTerm] = useState<string | null>(null);
  const [incomeText, setIncomeText] = useState('');
  const [expenditureText, setExpenditureText] = useState('');
  const [problems, setProblems] = useState<{
    amount?: MoneyInputProblem;
    term?: string;
    income?: MoneyInputProblem;
    expenditure?: MoneyInputProblem;
  }>({});

  const validate = (): CreditRequest | undefined => {
    const next: typeof problems = {};
    const amount = parseMoneyInput(amountText, CREDIT_CURRENCY, intl.locale);
    if (!amount.ok) next.amount = amount.problem;
    if (!isLine(product) && term === null) next.term = intl.formatMessage(messages.chooseTerm);
    const income = optionalAmount(incomeText, intl.locale);
    if (!income.ok) next.income = income.problem;
    const expenditure = optionalAmount(expenditureText, intl.locale);
    if (!expenditure.ok) next.expenditure = expenditure.problem;
    setProblems(next);
    if (!amount.ok || !income.ok || !expenditure.ok || (!isLine(product) && term === null)) return undefined;
    return {
      product,
      amount: amount.amount,
      currency: CREDIT_CURRENCY,
      ...(isLine(product) || term === null ? {} : { termMonths: Number(term) }),
      ...(income.amount === undefined ? {} : { declaredMonthlyIncome: income.amount }),
      ...(expenditure.amount === undefined ? {} : { declaredMonthlyExpenditure: expenditure.amount }),
    };
  };

  const fields = (
    <>
      <Radio.Group
        label={intl.formatMessage(messages.product)}
        value={product}
        onChange={(value) => setProduct(value === 'CREDIT_LINE' ? 'CREDIT_LINE' : 'PERSONAL_LOAN')}
      >
        <Group mt="xs">
          {APPLICABLE_PRODUCTS.map((code) => {
            const name = productName(code);
            return <Radio key={code} value={code} label={name === undefined ? code : intl.formatMessage(name)} />;
          })}
        </Group>
      </Radio.Group>
      <MoneyInput
        label={intl.formatMessage(messages.amount)}
        value={amountText}
        onChange={setAmountText}
        currency={CREDIT_CURRENCY}
        problem={problems.amount}
      />
      {isLine(product) ? null : (
        <Select
          label={intl.formatMessage(messages.term)}
          data={TERM_CHOICES.map((months) => ({ value: months, label: intl.formatMessage(monthsMessage, { months }) }))}
          value={term}
          onChange={setTerm}
          error={problems.term}
          allowDeselect={false}
          comboboxProps={{ withinPortal: false }}
        />
      )}
      <MoneyInput
        label={intl.formatMessage(messages.income)}
        value={incomeText}
        onChange={setIncomeText}
        currency={CREDIT_CURRENCY}
        problem={problems.income}
      />
      <MoneyInput
        label={intl.formatMessage(messages.expenditure)}
        value={expenditureText}
        onChange={setExpenditureText}
        currency={CREDIT_CURRENCY}
        problem={problems.expenditure}
      />
    </>
  );
  return { fields, validate };
}

/** The review rows a credit check and a loan application share. */
export function useCreditRows() {
  const intl = useIntl();
  return (body: CreditRequest) => {
    const name = productName(body.product);
    return [
      {
        label: intl.formatMessage(messages.product),
        value: name === undefined ? body.product : intl.formatMessage(name),
      },
      {
        label: intl.formatMessage(messages.amount),
        value: <Money amount={body.amount} currency={body.currency} />,
        emphasis: true,
      },
      ...(body.termMonths === undefined
        ? []
        : [
            {
              label: intl.formatMessage(messages.term),
              value: intl.formatMessage(monthsMessage, { months: String(body.termMonths) }),
            },
          ]),
      ...(body.declaredMonthlyIncome === undefined
        ? []
        : [
            {
              label: intl.formatMessage(messages.income),
              value: <Money amount={body.declaredMonthlyIncome} currency={body.currency} />,
            },
          ]),
      ...(body.declaredMonthlyExpenditure === undefined
        ? []
        : [
            {
              label: intl.formatMessage(messages.expenditure),
              value: <Money amount={body.declaredMonthlyExpenditure} currency={body.currency} />,
            },
          ]),
    ];
  };
}

export function CreditCheckPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const form = useCreditForm();
  const rows = useCreditRows();
  const flow = useReviewFlow(
    async (intent: IdempotencyIntent<CreditRequest>) =>
      ok(
        api.POST('/v1/me/credit/decision-requests', { body: { ...intent.body }, params: { header: intent.headers() } }),
      ),
    { invalidate: [CREDIT_ROOT], routeId: '/credit/check' },
  );

  const requestId = flow.state.status === 'succeeded' ? flow.state.data.requestId : undefined;
  useEffect(() => {
    if (requestId !== undefined) void navigate({ to: '/credit/checks/$requestId', params: { requestId } });
  }, [requestId, navigate]);

  const steps = [messages.stepDetails, messages.stepReview, messages.stepSent].map((m) => intl.formatMessage(m));
  const body = flow.body;

  return (
    <Stack gap="lg" maw={560}>
      <Link to="/credit">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text>
        <FormattedMessage {...messages.intro} />
      </Text>
      <Wizard steps={steps} current={flow.step === 'details' ? 0 : flow.step === 'review' ? 1 : 2}>
        {flow.step === 'details' ? (
          <Stack>
            {form.fields}
            <div>
              <Button
                onClick={() => {
                  const request = form.validate();
                  if (request !== undefined) flow.review(request);
                }}
              >
                <FormattedMessage {...messages.continue} />
              </Button>
            </div>
          </Stack>
        ) : flow.step === 'review' && body !== undefined ? (
          <ReviewPanel
            title={intl.formatMessage(messages.review)}
            rows={rows(body)}
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
          <Stack>
            <CommandOutcome state={flow.state} onChange={flow.back} onSendSame={() => void flow.confirm()} />
            <ConsentLink error={flow.state.error} />
          </Stack>
        ) : (
          <LoadingState label={intl.formatMessage(messages.sending)} />
        )}
      </Wizard>
    </Stack>
  );
}
