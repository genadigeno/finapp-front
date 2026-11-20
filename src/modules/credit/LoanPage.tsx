// A loan or credit line (P18-TSK-029): what the customer owes, as finapp breaks it down; the schedule, repayments
// and statements; and what they can do - repay, pay off, draw, close a line. An overdue payment is shown with how
// many days it is late (the customer's own arrears), never with a collections or risk label.
import { Alert, Button, Card, Group, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { INSTALMENT_STATUS, LOAN_STATUS, STATEMENT_STATUS } from '../../design-system/status.ts';
import { BusinessDate, CorrelationReference, StatusChip } from '../../design-system/Values.tsx';
import { ScrollableTable } from '../../design-system/ScrollableTable.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { CREDIT_ROOT, useLoan, useLoanRepayments, useLoanSchedule, useLoanStatements } from './api.ts';
import { AnnualRate, Facts, MaybeMoney, type Fact } from './CreditParts.tsx';
import { isLine, productName } from './labels.ts';
import {
  DefaultedNotice,
  LateFeeNote,
  moneyFacts,
  PayoutNotice,
  RepaymentHistory,
  RowWithDetails,
} from './ServicingParts.tsx';

const messages = defineMessages({
  back: { id: 'loan.back', defaultMessage: 'Back to Credit' },
  owed: { id: 'loan.owed', defaultMessage: 'You still owe (borrowed)' },
  principalDue: { id: 'loan.principalDue', defaultMessage: 'Borrowed amount due now' },
  interestDue: { id: 'loan.interestDue', defaultMessage: 'Interest due now' },
  feesDue: { id: 'loan.feesDue', defaultMessage: 'Fees due now' },
  interestAccrued: { id: 'loan.interestAccrued', defaultMessage: 'Interest built up, not yet due' },
  credit: { id: 'loan.credit', defaultMessage: 'In your favour' },
  available: { id: 'loan.available', defaultMessage: 'Available to draw' },
  limit: { id: 'loan.limit', defaultMessage: 'Credit limit' },
  rate: { id: 'loan.rate', defaultMessage: 'Interest rate' },
  repaymentDay: { id: 'loan.repaymentDay', defaultMessage: 'Repayment day' },
  payingOut: { id: 'loan.payingOut', defaultMessage: 'We are paying the money into your wallet.' },
  writtenOff: {
    id: 'loan.writtenOff',
    defaultMessage: 'We have stopped collecting payments, but the balance is still owed. Contact us about repaying it.',
  },
  drawsPaused: { id: 'loan.drawsPaused', defaultMessage: 'You cannot draw from this credit line at the moment.' },
  repay: { id: 'loan.repay', defaultMessage: 'Make a repayment' },
  payoff: { id: 'loan.payoff', defaultMessage: 'Pay off in full' },
  draw: { id: 'loan.draw', defaultMessage: 'Draw money' },
  close: { id: 'loan.close', defaultMessage: 'Close this credit line' },
  closeTitle: { id: 'loan.close.title', defaultMessage: 'Close this credit line?' },
  closeBody: {
    id: 'loan.close.body',
    defaultMessage:
      'You will not be able to draw from it again. If you still owe anything, it closes once that is repaid.',
  },
  closing: { id: 'loan.closing', defaultMessage: 'Your credit line closes once what you owe is repaid.' },
  schedule: { id: 'loan.tab.schedule', defaultMessage: 'Schedule' },
  repayments: { id: 'loan.tab.repayments', defaultMessage: 'Repayments' },
  statements: { id: 'loan.tab.statements', defaultMessage: 'Statements' },
  noSchedule: { id: 'loan.noSchedule', defaultMessage: 'Your schedule appears once the money is paid out' },
  noRepayments: { id: 'loan.noRepayments', defaultMessage: 'No repayments yet' },
  noStatements: { id: 'loan.noStatements', defaultMessage: 'No statements yet' },
  due: { id: 'loan.col.due', defaultMessage: 'Due' },
  amount: { id: 'loan.col.amount', defaultMessage: 'Amount' },
  status: { id: 'loan.col.status', defaultMessage: 'Status' },
  date: { id: 'loan.col.date', defaultMessage: 'Date' },
  statementDate: { id: 'loan.col.statementDate', defaultMessage: 'Statement date' },
  minimum: { id: 'loan.col.minimum', defaultMessage: 'Minimum to pay' },
  balance: { id: 'loan.col.balance', defaultMessage: 'Balance' },
  totalPayable: { id: 'loan.totalPayable', defaultMessage: 'Total to repay' },
  paid: { id: 'bnpl.col.paid', defaultMessage: 'Paid' },
  stillToPay: { id: 'loan.col.stillToPay', defaultMessage: 'Still to pay' },
  openingBalance: { id: 'loan.statement.opening', defaultMessage: 'Opening balance' },
  interestBilled: { id: 'loan.billing.interestBilled', defaultMessage: 'Interest billed' },
  principalBilled: { id: 'loan.billing.principalBilled', defaultMessage: 'Borrowed amount billed' },
  feesBilled: { id: 'loan.billing.feesBilled', defaultMessage: 'Fees billed' },
  interestPaid: { id: 'loan.billing.interestPaid', defaultMessage: 'Interest paid' },
  principalPaid: { id: 'loan.billing.principalPaid', defaultMessage: 'Borrowed amount paid' },
  feesPaid: { id: 'loan.billing.feesPaid', defaultMessage: 'Fees paid' },
  interestWaived: { id: 'loan.billing.interestWaived', defaultMessage: 'Interest waived' },
  notBilled: { id: 'loan.billing.none', defaultMessage: 'Not billed yet' },
});

const overdueMessage = defineMessage<{ days: string }>({
  id: 'loan.overdue',
  defaultMessage: 'A payment is overdue by {days} days. Repay now to avoid further charges.',
});
const dayMessage = defineMessage<{ day: string }>({ id: 'loanApply.dayOption', defaultMessage: 'Day {day}' });

function moneyRow(label: string, amount: string | undefined, currency: string, emphasis = false): Fact[] {
  return amount === undefined ? [] : [{ label, value: <MaybeMoney amount={amount} currency={currency} />, emphasis }];
}

export function LoanPage() {
  const intl = useIntl();
  const api = useApi();
  const { loanId } = useParams({ strict: false }) as { loanId: string };
  const [chosenTab, setTab] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const loan = useLoan(loanId);
  // Which tabs exist depends on the product: nothing below is read until the loan itself is (a credit line has no
  // instalment schedule, an instalment loan no statements).
  const known = loan.data !== undefined;
  const line = isLine(loan.data?.data.product);
  const tab = chosenTab ?? (line ? 'repayments' : 'schedule');
  const schedule = useLoanSchedule(loanId, known && tab === 'schedule' && !line);
  const repayments = useLoanRepayments(loanId, known && tab === 'repayments');
  const statements = useLoanStatements(loanId, known && tab === 'statements' && line);
  const close = useCommand(
    async (intent: IdempotencyIntent<{ id: string }>) =>
      ok(api.POST('/v1/me/loans/{id}/closure', { params: { path: { id: intent.body.id }, header: intent.headers() } })),
    { invalidate: [CREDIT_ROOT], routeId: '/credit/loans/$loanId' },
  );

  if (loan.isPending) return <LoadingState />;
  if (loan.isError) return <ErrorExplained error={loan.error} onRetry={() => void loan.refetch()} />;
  const view = loan.data.data;
  const currency = view.currency ?? '';
  const status = view.status ?? '';
  const balances = view.balances ?? {};
  const name = productName(view.product);
  const active = status === 'ACTIVE';
  // finapp accepts a repayment and a payoff on a closing credit line (it closes once nothing is owed); drawing and
  // closing are for an active line only. finapp's refusal stays the guard.
  const canRepay = active || (line && status === 'CLOSING');
  const closeFailure = failureOf(close.state);
  const closed = close.state.status === 'succeeded' ? close.state.data.outcome : undefined;

  const facts: Fact[] = [
    ...moneyRow(intl.formatMessage(messages.owed), balances.principalOutstanding, currency, true),
    ...moneyRow(intl.formatMessage(messages.principalDue), balances.principalDue, currency),
    ...moneyRow(intl.formatMessage(messages.interestDue), balances.interestDue, currency),
    ...moneyRow(intl.formatMessage(messages.feesDue), balances.feesDue, currency),
    ...moneyRow(intl.formatMessage(messages.interestAccrued), balances.interestAccrued, currency),
    ...moneyRow(intl.formatMessage(messages.credit), balances.creditBalance, currency),
    ...(line ? moneyRow(intl.formatMessage(messages.available), view.availableLimit, currency, true) : []),
    ...(line ? moneyRow(intl.formatMessage(messages.limit), view.agreement?.limit, currency) : []),
    { label: intl.formatMessage(messages.rate), value: <AnnualRate fraction={view.agreement?.nominalAnnualRate} /> },
    ...(view.agreement?.repaymentDay === undefined
      ? []
      : [
          {
            label: intl.formatMessage(messages.repaymentDay),
            value: intl.formatMessage(dayMessage, { day: String(view.agreement.repaymentDay) }),
          },
        ]),
  ];

  const link = (to: string, label: ReactNode, variant: 'filled' | 'default' = 'filled') => (
    <Button variant={variant} renderRoot={(props) => <Link {...props} to={to} params={{ loanId }} />}>
      {label}
    </Button>
  );

  return (
    <Stack gap="lg">
      <Link to="/credit">
        <FormattedMessage {...messages.back} />
      </Link>
      <Group gap="sm">
        <Title order={1}>{name === undefined ? view.product : intl.formatMessage(name)}</Title>
        <StatusChip value={status} map={LOAN_STATUS} />
      </Group>
      {view.condition?.delinquency === 'PAST_DUE' && view.condition.daysPastDue !== undefined ? (
        <Alert
          color="orange"
          title={intl.formatMessage(overdueMessage, { days: String(view.condition.daysPastDue) })}
        />
      ) : null}
      <DefaultedNotice defaulted={view.condition?.defaulted} />
      {view.payoutStatus !== undefined ? (
        <PayoutNotice status={view.payoutStatus} />
      ) : status === 'PENDING_DISBURSEMENT' ? (
        <Text>
          <FormattedMessage {...messages.payingOut} />
        </Text>
      ) : null}
      {status === 'WRITTEN_OFF' ? (
        <Text>
          <FormattedMessage {...messages.writtenOff} />
        </Text>
      ) : null}
      {status === 'CLOSING' || closed === 'CLOSING' ? (
        <Text>
          <FormattedMessage {...messages.closing} />
        </Text>
      ) : null}
      <Card withBorder radius="md" padding="lg">
        <Facts rows={facts} />
      </Card>
      {canRepay ? (
        <Group>
          {link('/credit/loans/$loanId/repay', <FormattedMessage {...messages.repay} />)}
          {link('/credit/loans/$loanId/payoff', <FormattedMessage {...messages.payoff} />, 'default')}
          {active && line && view.condition?.drawsSuspended !== true
            ? link('/credit/loans/$loanId/draw', <FormattedMessage {...messages.draw} />, 'default')
            : null}
          {active && line ? (
            <Button variant="default" onClick={() => setClosing(true)}>
              <FormattedMessage {...messages.close} />
            </Button>
          ) : null}
        </Group>
      ) : null}
      {active && line && view.condition?.drawsSuspended === true ? (
        <Text size="sm">
          <FormattedMessage {...messages.drawsPaused} />
        </Text>
      ) : null}
      {closeFailure === undefined ? null : <ErrorExplained error={closeFailure.error} />}
      {close.state.status === 'succeeded' ? <CorrelationReference correlationId={close.state.correlationId} /> : null}

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          {line ? null : <Tabs.Tab value="schedule">{intl.formatMessage(messages.schedule)}</Tabs.Tab>}
          <Tabs.Tab value="repayments">{intl.formatMessage(messages.repayments)}</Tabs.Tab>
          {line ? <Tabs.Tab value="statements">{intl.formatMessage(messages.statements)}</Tabs.Tab> : null}
        </Tabs.List>
        <Tabs.Panel value="schedule" pt="md">
          {schedule.isPending && schedule.fetchStatus !== 'idle' ? (
            <LoadingState rows={3} />
          ) : schedule.isError ? (
            <ErrorExplained error={schedule.error} onRetry={() => void schedule.refetch()} />
          ) : (schedule.data?.instalments ?? []).length === 0 ? (
            <EmptyState title={intl.formatMessage(messages.noSchedule)} />
          ) : (
            <Stack gap="xs">
              <ScrollableTable label={intl.formatMessage(messages.schedule)}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{intl.formatMessage(messages.due)}</Table.Th>
                      <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.amount)}</Table.Th>
                      <Table.Th>{intl.formatMessage(messages.status)}</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(schedule.data?.instalments ?? []).map((instalment, index) => {
                      const billing = instalment.billing;
                      const billingFacts = moneyFacts(
                        [
                          [intl.formatMessage(messages.principalBilled), billing?.principalBilled],
                          [intl.formatMessage(messages.interestBilled), billing?.interestBilled],
                          [intl.formatMessage(messages.feesBilled), billing?.feesBilled],
                          [intl.formatMessage(messages.principalPaid), billing?.principalPaid],
                          [intl.formatMessage(messages.interestPaid), billing?.interestPaid],
                          [intl.formatMessage(messages.feesPaid), billing?.feesPaid],
                          [intl.formatMessage(messages.interestWaived), billing?.interestWaived],
                          [intl.formatMessage(messages.stillToPay), billing?.outstanding],
                        ],
                        currency,
                      );
                      return (
                        <RowWithDetails
                          key={instalment.sequence ?? index}
                          colSpan={4}
                          cells={
                            <>
                              <Table.Td>
                                {instalment.dueDate === undefined ? null : <BusinessDate value={instalment.dueDate} />}
                              </Table.Td>
                              <Table.Td className="finapp-cell-amount">
                                <MaybeMoney amount={instalment.amount} currency={currency} />
                                <LateFeeNote fee={billing?.feesBilled} currency={currency} />
                              </Table.Td>
                              <Table.Td>
                                <StatusChip value={instalment.status ?? ''} map={INSTALMENT_STATUS} />
                              </Table.Td>
                            </>
                          }
                          details={
                            billingFacts.length === 0 ? (
                              <Text size="sm">{intl.formatMessage(messages.notBilled)}</Text>
                            ) : (
                              <Facts rows={billingFacts} />
                            )
                          }
                        />
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollableTable>
              {schedule.data?.totalPayable === undefined ? null : (
                <Text size="sm">
                  <FormattedMessage {...messages.totalPayable} />{' '}
                  <MaybeMoney amount={schedule.data.totalPayable} currency={currency} />
                </Text>
              )}
            </Stack>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="repayments" pt="md">
          {repayments.isPending && repayments.fetchStatus !== 'idle' ? (
            <LoadingState rows={3} />
          ) : repayments.isError ? (
            <ErrorExplained error={repayments.error} onRetry={() => void repayments.refetch()} />
          ) : (repayments.data ?? []).length === 0 ? (
            <EmptyState title={intl.formatMessage(messages.noRepayments)} />
          ) : (
            <ScrollableTable label={intl.formatMessage(messages.repayments)}>
              <RepaymentHistory repayments={repayments.data ?? []} currency={currency} />
            </ScrollableTable>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="statements" pt="md">
          {statements.isPending && statements.fetchStatus !== 'idle' ? (
            <LoadingState rows={3} />
          ) : statements.isError ? (
            <ErrorExplained error={statements.error} onRetry={() => void statements.refetch()} />
          ) : (statements.data ?? []).length === 0 ? (
            <EmptyState title={intl.formatMessage(messages.noStatements)} />
          ) : (
            <ScrollableTable label={intl.formatMessage(messages.statements)}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{intl.formatMessage(messages.statementDate)}</Table.Th>
                    <Table.Th>{intl.formatMessage(messages.status)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.balance)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.minimum)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.paid)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.stillToPay)}</Table.Th>
                    <Table.Th>{intl.formatMessage(messages.due)}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(statements.data ?? []).map((statement, index) => {
                    const own = statement.currency ?? currency;
                    const detail = moneyFacts(
                      [
                        [intl.formatMessage(messages.openingBalance), statement.openingBalance],
                        [intl.formatMessage(messages.principalBilled), statement.principalBilled],
                        [intl.formatMessage(messages.interestBilled), statement.interestBilled],
                        [intl.formatMessage(messages.feesBilled), statement.feesBilled],
                        [intl.formatMessage(messages.interestWaived), statement.interestWaived],
                      ],
                      own,
                    );
                    return (
                      <RowWithDetails
                        key={statement.statementId ?? index}
                        colSpan={8}
                        cells={
                          <>
                            <Table.Td>
                              {statement.statementDate === undefined ? null : (
                                <BusinessDate value={statement.statementDate} />
                              )}
                            </Table.Td>
                            <Table.Td>
                              <StatusChip value={statement.status ?? ''} map={STATEMENT_STATUS} />
                            </Table.Td>
                            <Table.Td className="finapp-cell-amount">
                              <MaybeMoney amount={statement.closingBalance} currency={own} />
                            </Table.Td>
                            <Table.Td className="finapp-cell-amount">
                              <MaybeMoney amount={statement.minimumPayment} currency={own} />
                            </Table.Td>
                            <Table.Td className="finapp-cell-amount">
                              <MaybeMoney amount={statement.paid} currency={own} />
                            </Table.Td>
                            <Table.Td className="finapp-cell-amount">
                              <MaybeMoney amount={statement.outstanding} currency={own} />
                            </Table.Td>
                            <Table.Td>
                              {statement.dueDate === undefined ? null : <BusinessDate value={statement.dueDate} />}
                            </Table.Td>
                          </>
                        }
                        details={<Facts rows={detail} />}
                      />
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollableTable>
          )}
        </Tabs.Panel>
      </Tabs>

      <ConfirmDangerous
        opened={closing}
        title={intl.formatMessage(messages.closeTitle)}
        confirmLabel={intl.formatMessage(messages.close)}
        busy={close.state.status === 'sending'}
        onCancel={() => setClosing(false)}
        onConfirm={() =>
          void close.submit({ id: loanId }).finally(() => {
            setClosing(false);
            void loan.refetch();
          })
        }
      >
        <Text>
          <FormattedMessage {...messages.closeBody} />
        </Text>
      </ConfirmDangerous>
    </Stack>
  );
}
