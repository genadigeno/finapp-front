// A pay-later plan (P18-TSK-030): the purchase, what is still owed, the instalments with what was paid and what is
// still due on each, the repayments made, and what the customer can do - repay, pay off, or dispute the purchase.
import { Alert, Button, Card, Group, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { BNPL_AGREEMENT_STATUS } from '../../design-system/status.ts';
import { BusinessDate, StatusChip } from '../../design-system/Values.tsx';
import { ScrollableTable } from '../../design-system/ScrollableTable.tsx';
import { useBnplAgreement, useBnplRepayments, useBnplSchedule } from './api.ts';
import { Facts, MaybeMoney, type Fact } from './CreditParts.tsx';
import { planName, productName } from './labels.ts';

const messages = defineMessages({
  back: { id: 'bnpl.back', defaultMessage: 'Back to Credit' },
  purchase: { id: 'bnpl.purchase', defaultMessage: 'Purchase' },
  purchaseDate: { id: 'bnpl.purchaseDate', defaultMessage: 'Bought on' },
  owed: { id: 'loan.owed', defaultMessage: 'You still owe (borrowed)' },
  principalDue: { id: 'loan.principalDue', defaultMessage: 'Borrowed amount due now' },
  interestDue: { id: 'loan.interestDue', defaultMessage: 'Interest due now' },
  feesDue: { id: 'loan.feesDue', defaultMessage: 'Fees due now' },
  credit: { id: 'loan.credit', defaultMessage: 'In your favour' },
  writtenOff: {
    id: 'loan.writtenOff',
    defaultMessage: 'We have stopped collecting payments, but the balance is still owed. Contact us about repaying it.',
  },
  repay: { id: 'loan.repay', defaultMessage: 'Make a repayment' },
  payoff: { id: 'loan.payoff', defaultMessage: 'Pay off in full' },
  dispute: { id: 'bnpl.dispute', defaultMessage: 'Report a problem with the purchase' },
  schedule: { id: 'loan.tab.schedule', defaultMessage: 'Schedule' },
  repayments: { id: 'loan.tab.repayments', defaultMessage: 'Repayments' },
  noSchedule: { id: 'bnpl.noSchedule', defaultMessage: 'No instalments to show' },
  noRepayments: { id: 'loan.noRepayments', defaultMessage: 'No repayments yet' },
  due: { id: 'loan.col.due', defaultMessage: 'Due' },
  amount: { id: 'loan.col.amount', defaultMessage: 'Amount' },
  paid: { id: 'bnpl.col.paid', defaultMessage: 'Paid' },
  stillDue: { id: 'bnpl.col.stillDue', defaultMessage: 'Still due' },
  date: { id: 'loan.col.date', defaultMessage: 'Date' },
});

const overdueMessage = defineMessage<{ days: string }>({
  id: 'loan.overdue',
  defaultMessage: 'A payment is overdue by {days} days. Repay now to avoid further charges.',
});

export function BnplAgreementPage() {
  const intl = useIntl();
  const { agreementId } = useParams({ strict: false }) as { agreementId: string };
  const [tab, setTab] = useState<string | null>('schedule');
  const agreement = useBnplAgreement(agreementId);
  const schedule = useBnplSchedule(agreementId, tab === 'schedule');
  const repayments = useBnplRepayments(agreementId, tab === 'repayments');

  if (agreement.isPending) return <LoadingState />;
  if (agreement.isError) return <ErrorExplained error={agreement.error} onRetry={() => void agreement.refetch()} />;
  const view = agreement.data.data;
  const currency = view.currency ?? '';
  const status = view.status ?? '';
  const balances = view.balances ?? {};
  const name = planName(view.plan) ?? productName(view.product);
  const money = (label: string, amount: string | undefined, emphasis = false): Fact[] =>
    amount === undefined ? [] : [{ label, value: <MaybeMoney amount={amount} currency={currency} />, emphasis }];
  const facts: Fact[] = [
    ...money(intl.formatMessage(messages.purchase), view.amount),
    ...(view.purchaseDate === undefined
      ? []
      : [{ label: intl.formatMessage(messages.purchaseDate), value: <BusinessDate value={view.purchaseDate} /> }]),
    ...money(intl.formatMessage(messages.owed), balances.principalOutstanding, true),
    ...money(intl.formatMessage(messages.principalDue), balances.principalDue),
    ...money(intl.formatMessage(messages.interestDue), balances.interestDue),
    ...money(intl.formatMessage(messages.feesDue), balances.feesDue),
    ...money(intl.formatMessage(messages.credit), balances.creditBalance),
  ];
  const link = (to: string, label: ReactNode, variant: 'filled' | 'default' = 'filled') => (
    <Button variant={variant} renderRoot={(props) => <Link {...props} to={to} params={{ agreementId }} />}>
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
        <StatusChip value={status} map={BNPL_AGREEMENT_STATUS} />
      </Group>
      {view.condition?.delinquency === 'PAST_DUE' && view.condition.daysPastDue !== undefined ? (
        <Alert
          color="orange"
          title={intl.formatMessage(overdueMessage, { days: String(view.condition.daysPastDue) })}
        />
      ) : null}
      {status === 'WRITTEN_OFF' ? (
        <Text>
          <FormattedMessage {...messages.writtenOff} />
        </Text>
      ) : null}
      <Card withBorder radius="md" padding="lg">
        <Facts rows={facts} />
      </Card>
      {status === 'ACTIVE' ? (
        <Group>
          {link('/credit/pay-later/$agreementId/repay', <FormattedMessage {...messages.repay} />)}
          {link('/credit/pay-later/$agreementId/payoff', <FormattedMessage {...messages.payoff} />, 'default')}
          {link('/credit/pay-later/$agreementId/dispute', <FormattedMessage {...messages.dispute} />, 'default')}
        </Group>
      ) : null}
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="schedule">{intl.formatMessage(messages.schedule)}</Tabs.Tab>
          <Tabs.Tab value="repayments">{intl.formatMessage(messages.repayments)}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="schedule" pt="md">
          {schedule.isPending && schedule.fetchStatus !== 'idle' ? (
            <LoadingState rows={3} />
          ) : schedule.isError ? (
            <ErrorExplained error={schedule.error} onRetry={() => void schedule.refetch()} />
          ) : (schedule.data?.instalments ?? []).length === 0 ? (
            <EmptyState title={intl.formatMessage(messages.noSchedule)} />
          ) : (
            <ScrollableTable label={intl.formatMessage(messages.schedule)}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{intl.formatMessage(messages.due)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.amount)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.paid)}</Table.Th>
                    <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.stillDue)}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(schedule.data?.instalments ?? []).map((instalment, index) => (
                    <Table.Tr key={instalment.sequence ?? index}>
                      <Table.Td>
                        {instalment.dueDate === undefined ? null : <BusinessDate value={instalment.dueDate} />}
                      </Table.Td>
                      <Table.Td className="finapp-cell-amount">
                        <MaybeMoney amount={instalment.amount} currency={currency} />
                      </Table.Td>
                      <Table.Td className="finapp-cell-amount">
                        <MaybeMoney amount={instalment.paid} currency={currency} />
                      </Table.Td>
                      <Table.Td className="finapp-cell-amount">
                        <MaybeMoney amount={instalment.due} currency={currency} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollableTable>
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
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{intl.formatMessage(messages.date)}</Table.Th>
                  <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.amount)}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(repayments.data ?? []).map((repayment, index) => (
                  <Table.Tr key={repayment.repaymentId ?? index}>
                    <Table.Td>
                      {repayment.valueDate === undefined ? null : <BusinessDate value={repayment.valueDate} />}
                    </Table.Td>
                    <Table.Td className="finapp-cell-amount">
                      <MaybeMoney amount={repayment.amount} currency={repayment.currency ?? currency} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
