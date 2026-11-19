// An offer (P18-TSK-029, -030; blueprint §4.6): a loan, credit line or pay-later offer, read before it is
// accepted. The customer sees every figure finapp computed - the amount, the fixed rate, the illustrated schedule,
// the total interest and the total to repay - and the agreement text itself. Accepting echoes the hash of the terms
// the customer read; if finapp's terms changed meanwhile it refuses (TermsChanged) and the page shows the new ones
// to read again. finapp sends no APR (its decision L8): none is shown or computed here.
import { Button, Checkbox, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CommandOutcome } from '../../design-system/CommandOutcome.tsx';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { basisPointsToPercent } from '../../design-system/money.ts';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { OFFER_STATUS } from '../../design-system/status.ts';
import { BusinessDate, Countdown, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { ResultPanel, ReviewPanel } from '../../design-system/Workflow.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';
import { useOnline } from '../../platform/online.ts';
import { CREDIT_ROOT, type CreditKind } from './api.ts';
import { AnnualRate, MaybeMoney, OfferDocument, ScheduleTable, useValueText, type Fact } from './CreditParts.tsx';
import { isLine, planName, productName } from './labels.ts';

const messages = defineMessages({
  title: { id: 'offer.title', defaultMessage: 'Your offer' },
  amount: { id: 'offer.amount', defaultMessage: 'You borrow' },
  purchase: { id: 'offer.purchase', defaultMessage: 'Your purchase' },
  limit: { id: 'offer.limit', defaultMessage: 'Your credit limit' },
  term: { id: 'offer.term', defaultMessage: 'Over' },
  rate: { id: 'offer.rate', defaultMessage: 'Interest rate' },
  instalment: { id: 'offer.instalment', defaultMessage: 'Monthly payment' },
  regular: { id: 'offer.regular', defaultMessage: 'Each payment' },
  first: { id: 'offer.first', defaultMessage: 'First payment' },
  finalInstalment: { id: 'offer.final', defaultMessage: 'Last payment' },
  firstDue: { id: 'offer.firstDue', defaultMessage: 'First payment due' },
  totalInterest: { id: 'offer.totalInterest', defaultMessage: 'Total interest' },
  totalPayable: { id: 'offer.totalPayable', defaultMessage: 'Total to repay' },
  minimum: { id: 'offer.minimum', defaultMessage: 'Minimum monthly payment' },
  openUntil: { id: 'offer.openUntil', defaultMessage: 'You can accept until' },
  schedule: { id: 'offer.schedule', defaultMessage: 'Repayment schedule (illustration)' },
  illustrative: {
    id: 'offer.illustrative',
    defaultMessage: 'This schedule is an illustration. Your schedule is fixed when the money is paid out.',
  },
  document: { id: 'offer.document', defaultMessage: 'Read the agreement' },
  read: { id: 'offer.read', defaultMessage: 'I have read the agreement and the figures above' },
  accept: { id: 'offer.accept', defaultMessage: 'Accept and sign' },
  acceptNotice: {
    id: 'offer.acceptNotice',
    defaultMessage: 'Accepting is a legal agreement to borrow. We will ask for the code from your authenticator app.',
  },
  offline: { id: 'offer.offline', defaultMessage: 'You are offline. Nothing will be sent.' },
  expired: { id: 'offer.expired', defaultMessage: 'This offer has expired.' },
  decline: { id: 'offer.decline', defaultMessage: 'Decline this offer' },
  declineTitle: { id: 'offer.decline.title', defaultMessage: 'Decline this offer?' },
  declineBody: { id: 'offer.decline.body', defaultMessage: 'The offer closes. You can apply again later.' },
  closedAccepted: { id: 'offer.closed.accepted', defaultMessage: 'You accepted this offer.' },
  closedOther: { id: 'offer.closed.other', defaultMessage: 'This offer is closed.' },
  loanDone: { id: 'offer.done.loan', defaultMessage: 'Your loan is agreed' },
  loanDoneBody: { id: 'offer.done.loan.body', defaultMessage: 'The money is on its way to your wallet.' },
  lineDone: { id: 'offer.done.line', defaultMessage: 'Your credit line is open' },
  lineDoneBody: { id: 'offer.done.line.body', defaultMessage: 'Draw from it whenever you need to.' },
  bnplDone: { id: 'offer.done.bnpl', defaultMessage: 'Your purchase is paid' },
  bnplDoneBody: {
    id: 'offer.done.bnpl.body',
    defaultMessage: 'The shop has been paid. You repay us on the schedule you accepted. You can return to the shop.',
  },
  seeLoan: { id: 'offer.seeLoan', defaultMessage: 'See your loan' },
  seePlan: { id: 'offer.seePlan', defaultMessage: 'See your plan' },
  back: { id: 'offer.back', defaultMessage: 'Back to Credit' },
});

const monthsMessage = defineMessage<{ months: string }>({ id: 'credit.months', defaultMessage: '{months} months' });
const minimumMessage = defineMessage<{ percent: string; floor: string; days: string }>({
  id: 'offer.minimum.value',
  defaultMessage: '{percent}% of the balance, at least {floor}, due {days} days after each statement',
});

interface OfferView {
  offerId?: string;
  status?: string;
  product?: string;
  plan?: string;
  currency?: string;
  amount?: string;
  termMonths?: number;
  nominalAnnualRate?: string;
  expiresAt?: string;
  termsSha256?: string;
  document?: string;
  minimumPayment?: { floor?: string; ratioBasisPoints?: number; paymentDueDays?: number };
  illustration?: {
    instalment?: string;
    firstInstalment?: string;
    regularInstalment?: string;
    finalInstalment?: string;
    firstDueDate?: string;
    totalInterest?: string;
    totalPayable?: string;
    periods?: ReadonlyArray<Record<string, unknown>>;
    instalments?: ReadonlyArray<Record<string, unknown>>;
  };
}

interface Accepted {
  loanId?: string;
  agreementId?: string;
}

export function OfferPage({ kind }: { kind: CreditKind }) {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const online = useOnline();
  const text = useValueText();
  const { offerId } = useParams({ strict: false }) as { offerId: string };
  const [read, setRead] = useState(false);
  const [expired, setExpired] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [round, setRound] = useState(0);
  const routeId = kind === 'loan' ? '/credit/offers/$offerId' : '/credit/pay-later/offers/$offerId';

  const offer = useQuery({
    queryKey: [CREDIT_ROOT, kind, 'offer', offerId],
    queryFn: async (): Promise<OfferView> =>
      kind === 'loan'
        ? (await ok(api.GET('/v1/me/loan-offers/{id}', { params: { path: { id: offerId } } }))).data
        : (await ok(api.GET('/v1/me/bnpl-offers/{id}', { params: { path: { id: offerId } } }))).data,
  });
  const accept = useCommand(
    async (intent: IdempotencyIntent<{ termsSha256: string }>) => {
      const init = { body: { ...intent.body }, params: { path: { id: offerId }, header: intent.headers() } };
      return kind === 'loan'
        ? ok(api.POST('/v1/me/loan-offers/{id}/acceptance', init))
        : ok(api.POST('/v1/me/bnpl-offers/{id}/acceptance', init));
    },
    { invalidate: [CREDIT_ROOT, ACCOUNTS_ROOT], routeId },
  );
  const decline = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) => {
      const init = { params: { path: { id: intent.body.id }, header: intent.headers() } };
      return kind === 'loan'
        ? ok(api.POST('/v1/me/loan-offers/{id}/decline', init))
        : ok(api.POST('/v1/me/bnpl-offers/{id}/decline', init));
    },
    { invalidate: [CREDIT_ROOT], routeId },
  );

  if (offer.isPending) return <LoadingState />;
  if (offer.isError) return <ErrorExplained error={offer.error} onRetry={() => void offer.refetch()} />;
  const view = offer.data;
  const status = view.status ?? '';
  const currency = view.currency ?? '';
  const line = isLine(view.product);
  const illustration = view.illustration;
  const name = planName(view.plan) ?? productName(view.product);
  const acceptFailure = failureOf(accept.state);

  // finapp's terms moved since this page read them: read them again, then accept the new hash.
  const reread = () => {
    accept.discard();
    setRead(false);
    setRound((value) => value + 1);
    void offer.refetch();
  };

  if (accept.state.status === 'succeeded') {
    const done = accept.state.data as Accepted;
    const loanId = done.loanId;
    const agreementId = done.agreementId;
    return (
      <Stack gap="lg" maw={640}>
        <ResultPanel
          kind="succeeded"
          title={intl.formatMessage(kind === 'bnpl' ? messages.bnplDone : line ? messages.lineDone : messages.loanDone)}
          correlationId={accept.state.correlationId}
          actions={
            kind === 'loan' && loanId !== undefined ? (
              <Button onClick={() => void navigate({ to: '/credit/loans/$loanId', params: { loanId } })}>
                <FormattedMessage {...messages.seeLoan} />
              </Button>
            ) : kind === 'bnpl' && agreementId !== undefined ? (
              <Button onClick={() => void navigate({ to: '/credit/pay-later/$agreementId', params: { agreementId } })}>
                <FormattedMessage {...messages.seePlan} />
              </Button>
            ) : undefined
          }
        >
          <FormattedMessage
            {...(kind === 'bnpl' ? messages.bnplDoneBody : line ? messages.lineDoneBody : messages.loanDoneBody)}
          />
        </ResultPanel>
      </Stack>
    );
  }

  const facts: Fact[] = [
    {
      label: intl.formatMessage(kind === 'bnpl' ? messages.purchase : line ? messages.limit : messages.amount),
      value: <MaybeMoney amount={view.amount} currency={currency} />,
      emphasis: true,
    },
    ...(view.termMonths === undefined || line
      ? []
      : [
          {
            label: intl.formatMessage(messages.term),
            value: intl.formatMessage(monthsMessage, { months: String(view.termMonths) }),
          },
        ]),
    { label: intl.formatMessage(messages.rate), value: <AnnualRate fraction={view.nominalAnnualRate} /> },
    ...(illustration?.instalment === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.instalment),
            value: <MaybeMoney amount={illustration.instalment} currency={currency} />,
          },
        ]),
    ...(illustration?.firstInstalment === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.first),
            value: <MaybeMoney amount={illustration.firstInstalment} currency={currency} />,
          },
        ]),
    ...(illustration?.regularInstalment === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.regular),
            value: <MaybeMoney amount={illustration.regularInstalment} currency={currency} />,
          },
        ]),
    ...(illustration?.finalInstalment === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.finalInstalment),
            value: <MaybeMoney amount={illustration.finalInstalment} currency={currency} />,
          },
        ]),
    ...(illustration?.firstDueDate === undefined
      ? []
      : [{ label: intl.formatMessage(messages.firstDue), value: <BusinessDate value={illustration.firstDueDate} /> }]),
    ...(illustration?.totalInterest === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.totalInterest),
            value: <MaybeMoney amount={illustration.totalInterest} currency={currency} />,
            emphasis: true,
          },
        ]),
    ...(illustration?.totalPayable === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.totalPayable),
            value: <MaybeMoney amount={illustration.totalPayable} currency={currency} />,
            emphasis: true,
          },
        ]),
    ...(view.minimumPayment?.ratioBasisPoints === undefined || view.minimumPayment.floor === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.minimum),
            value: intl.formatMessage(minimumMessage, {
              percent:
                basisPointsToPercent(String(view.minimumPayment.ratioBasisPoints)) ??
                String(view.minimumPayment.ratioBasisPoints),
              floor: text.money(view.minimumPayment.floor, currency),
              days: String(view.minimumPayment.paymentDueDays ?? ''),
            }),
          },
        ]),
    ...(view.expiresAt === undefined || kind === 'bnpl'
      ? []
      : [{ label: intl.formatMessage(messages.openUntil), value: <Timestamp value={view.expiresAt} /> }]),
  ];
  const periods = (illustration?.periods ?? illustration?.instalments ?? []) as ReadonlyArray<{
    sequence?: number;
    dueDate?: string;
    amount?: string;
    instalment?: string;
    principal?: string;
    interest?: string;
  }>;
  const open = status === 'OFFERED';
  const stale = acceptFailure?.error.category === 'stale';

  return (
    <Stack gap="lg" maw={640}>
      <Link to="/credit">
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <StatusChip value={status} map={OFFER_STATUS} />
      {name === undefined ? null : <Text fw={600}>{intl.formatMessage(name)}</Text>}
      {periods.length === 0 ? null : (
        <Stack gap="xs">
          <Title order={2}>
            <FormattedMessage {...messages.schedule} />
          </Title>
          <Text size="sm" c="dimmed">
            <FormattedMessage {...messages.illustrative} />
          </Text>
          <ScheduleTable periods={periods} currency={currency} label={intl.formatMessage(messages.schedule)} />
        </Stack>
      )}
      {!open ? (
        <Stack gap="sm">
          <Text>
            <FormattedMessage {...(status === 'ACCEPTED' ? messages.closedAccepted : messages.closedOther)} />
          </Text>
        </Stack>
      ) : acceptFailure !== undefined && !stale ? (
        <CommandOutcome
          state={acceptFailure}
          onChange={reread}
          onSendSame={() => {
            if (view.termsSha256 !== undefined) void accept.submit({ termsSha256: view.termsSha256 });
          }}
        />
      ) : (
        <ReviewPanel
          // A new set of terms is a new review: the panel's one-press guard starts again.
          key={`${view.termsSha256 ?? ''}-${round}`}
          title={intl.formatMessage(messages.document)}
          rows={facts}
          notice={
            <Stack gap="sm">
              {stale ? <ErrorExplained error={acceptFailure.error} /> : null}
              {view.document === undefined ? null : <OfferDocument text={view.document} />}
              <Checkbox
                label={intl.formatMessage(messages.read)}
                checked={read}
                onChange={(event) => setRead(event.currentTarget.checked)}
              />
              {kind === 'bnpl' && view.expiresAt !== undefined ? (
                <Countdown expiresAt={view.expiresAt} onExpire={() => setExpired(true)} />
              ) : null}
              <Text size="sm">
                <FormattedMessage
                  {...(!online ? messages.offline : expired ? messages.expired : messages.acceptNotice)}
                />
              </Text>
            </Stack>
          }
          confirmLabel={intl.formatMessage(messages.accept)}
          confirmDisabled={!read || !online || expired || view.termsSha256 === undefined || stale}
          onConfirm={async () => {
            if (view.termsSha256 !== undefined) await accept.submit({ termsSha256: view.termsSha256 });
          }}
        />
      )}
      {stale ? (
        <div>
          <Button onClick={reread}>
            <FormattedMessage {...messages.document} />
          </Button>
        </div>
      ) : null}
      {open ? (
        <div>
          <Button variant="default" onClick={() => setDeclining(true)}>
            <FormattedMessage {...messages.decline} />
          </Button>
        </div>
      ) : null}
      {failureOf(decline.state) === undefined ? null : <ErrorExplained error={failureOf(decline.state)?.error} />}
      <ConfirmDangerous
        opened={declining}
        title={intl.formatMessage(messages.declineTitle)}
        confirmLabel={intl.formatMessage(messages.decline)}
        busy={decline.state.status === 'sending'}
        onCancel={() => setDeclining(false)}
        onConfirm={() =>
          void decline.submit({ id: offerId }).finally(() => {
            setDeclining(false);
            void offer.refetch();
          })
        }
      >
        <Text>
          <FormattedMessage {...messages.declineBody} />
        </Text>
      </ConfirmDangerous>
    </Stack>
  );
}

export const LoanOfferPage = () => <OfferPage kind="loan" />;
export const BnplOfferPage = () => <OfferPage kind="bnpl" />;
