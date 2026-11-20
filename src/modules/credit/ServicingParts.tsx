// What was really paid (WP-3): repayment history with its status, kind and allocation breakdown; a row that opens to
// show finapp's billing detail; the late-fee note; an account's condition and payout. Every figure is finapp's as
// sent - nothing here adds, subtracts or totals, so a reversed repayment can never be counted as paid.
import { Alert, Button, Stack, Table, Text } from '@mantine/core';
import { Fragment, useId, useState, type ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { REPAYMENT_STATUS } from '../../design-system/status.ts';
import { BusinessDate, StatusChip } from '../../design-system/Values.tsx';
import { MaybeMoney, useValueText, type Fact } from './CreditParts.tsx';

const messages = defineMessages({
  date: { id: 'loan.col.date', defaultMessage: 'Date' },
  what: { id: 'repayment.col.what', defaultMessage: 'Type' },
  amount: { id: 'loan.col.amount', defaultMessage: 'Amount' },
  status: { id: 'loan.col.status', defaultMessage: 'Status' },
  details: { id: 'credit.details.show', defaultMessage: 'Show details' },
  hideDetails: { id: 'credit.details.hide', defaultMessage: 'Hide details' },
  noBreakdown: { id: 'repayment.noBreakdown', defaultMessage: 'No breakdown for this payment' },
  breakdown: { id: 'repayment.breakdown', defaultMessage: 'How this payment was used' },
  breakdownReversed: {
    id: 'repayment.breakdownReversed',
    defaultMessage: 'How this payment was used before it was reversed - none of it counts as paid',
  },
  defaulted: { id: 'credit.defaulted', defaultMessage: 'This account is in default' },
});

const kinds = defineMessages({
  CUSTOMER: { id: 'repayment.kind.customer', defaultMessage: 'You paid' },
  AUTO_COLLECTION: { id: 'repayment.kind.auto', defaultMessage: 'Collected automatically' },
  PAYOFF: { id: 'repayment.kind.payoff', defaultMessage: 'Paid off in full' },
  PREPAYMENT: { id: 'repayment.kind.prepayment', defaultMessage: 'Extra payment' },
});
const genericKind = defineMessage({ id: 'repayment.kind.other', defaultMessage: 'Payment' });

const components = defineMessages({
  FEES: { id: 'repayment.allocation.fees', defaultMessage: 'Fees' },
  INTEREST: { id: 'repayment.allocation.interest', defaultMessage: 'Interest' },
  PRINCIPAL: { id: 'repayment.allocation.principal', defaultMessage: 'Borrowed amount' },
});
const targets = defineMessages({
  CREDIT_BALANCE: { id: 'repayment.allocation.creditBalance', defaultMessage: 'Kept as credit in your favour' },
  NOT_DUE_PRINCIPAL: { id: 'repayment.allocation.notDue', defaultMessage: 'Borrowed amount not yet due' },
});
const otherAllocation = defineMessage({ id: 'repayment.allocation.other', defaultMessage: 'Other' });

const refundMessage = defineMessage<{ amount: string }>({
  id: 'repayment.closureRefund',
  defaultMessage: 'Refunded to you when the account closed: {amount}',
});
const lateFeeMessage = defineMessage<{ amount: string }>({
  id: 'credit.lateFee',
  defaultMessage: 'Includes a late fee of {amount}',
});

const payout = defineMessages({
  PENDING: { id: 'loan.payout.sending', defaultMessage: 'We are sending the money to your bank account.' },
  DISPATCHING: { id: 'loan.payout.sending', defaultMessage: 'We are sending the money to your bank account.' },
  DISPATCHED: { id: 'loan.payout.sending', defaultMessage: 'We are sending the money to your bank account.' },
  PAID_OUT: { id: 'loan.payout.paidOut', defaultMessage: 'The money has been paid into your bank account.' },
  FAILED: {
    id: 'loan.payout.inWallet',
    defaultMessage: 'We could not send the money to your bank account. It is in your wallet.',
  },
  NOT_DISPATCHED: {
    id: 'loan.payout.inWallet',
    defaultMessage: 'We could not send the money to your bank account. It is in your wallet.',
  },
});
const payoutUnknown = defineMessage({
  id: 'loan.payout.unknown',
  defaultMessage: 'We are paying out the money. Check back for its progress.',
});

function lookup(map: Record<string, MessageDescriptor>, code: string | undefined): MessageDescriptor | undefined {
  return code !== undefined && Object.hasOwn(map, code) ? map[code] : undefined;
}

/** A repayment's kind in our words; one we do not know reads as a plain payment. */
export const repaymentKindName = (kind: string | undefined): MessageDescriptor => lookup(kinds, kind) ?? genericKind;

/** What finapp's payout status means for the customer; never "your wallet" unless finapp says the money is there. */
export const payoutWords = (status: string): MessageDescriptor => lookup(payout, status) ?? payoutUnknown;

/** True when finapp's decimal string is a zero ("0", "0.00"). A text test, never arithmetic. */
export function isZeroAmount(amount: string): boolean {
  return /^[+-]?0*(\.0*)?$/.test(amount.trim()) && /\d/.test(amount);
}

export interface Allocation {
  amount?: string;
  component?: string;
  target?: string;
}

export interface RepaymentEntry {
  repaymentId?: string;
  valueDate?: string;
  kind?: string;
  amount?: string;
  currency?: string;
  status?: string;
  allocations?: Allocation[];
  closure?: { reason?: string; refunded?: string };
}

function allocationName(allocation: Allocation): MessageDescriptor {
  return lookup(targets, allocation.target) ?? lookup(components, allocation.component) ?? otherAllocation;
}

/** A table row that opens a second row beneath it with finapp's detail. */
export function RowWithDetails({ cells, details, colSpan }: { cells: ReactNode; details: ReactNode; colSpan: number }) {
  const intl = useIntl();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <Fragment>
      <Table.Tr>
        {cells}
        <Table.Td>
          <Button
            variant="subtle"
            size="compact-sm"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((value) => !value)}
          >
            {intl.formatMessage(open ? messages.hideDetails : messages.details)}
          </Button>
        </Table.Td>
      </Table.Tr>
      {open ? (
        <Table.Tr id={id}>
          <Table.Td colSpan={colSpan}>{details}</Table.Td>
        </Table.Tr>
      ) : null}
    </Fragment>
  );
}

/** Money facts, only those finapp sent. */
export function moneyFacts(
  rows: readonly [label: string, amount: string | undefined][],
  currency: string | undefined,
): Fact[] {
  return rows.flatMap(([label, amount]) =>
    amount === undefined ? [] : [{ label, value: <MaybeMoney amount={amount} currency={currency} /> }],
  );
}

/** "Includes a late fee of X" when finapp billed a fee on the instalment - why "due" can exceed the instalment. */
export function LateFeeNote({ fee, currency }: { fee: string | undefined; currency: string }) {
  const intl = useIntl();
  const text = useValueText();
  if (fee === undefined || currency === '' || isZeroAmount(fee)) return null;
  return (
    <Text size="xs" c="dimmed">
      {intl.formatMessage(lateFeeMessage, { amount: text.money(fee, currency) })}
    </Text>
  );
}

/**
 * Repayments as finapp lists them: date, kind, amount and status, each opening to how it was used. A reversed
 * repayment says so and is struck through; nothing on this page totals repayments.
 */
export function RepaymentHistory({
  repayments,
  currency,
}: {
  repayments: readonly RepaymentEntry[];
  currency: string;
}) {
  const intl = useIntl();
  const text = useValueText();
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{intl.formatMessage(messages.date)}</Table.Th>
          <Table.Th>{intl.formatMessage(messages.what)}</Table.Th>
          <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.amount)}</Table.Th>
          <Table.Th>{intl.formatMessage(messages.status)}</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {repayments.map((repayment, index) => {
          const own = repayment.currency ?? currency;
          const reversed = repayment.status === 'REVERSED';
          const allocations = repayment.allocations ?? [];
          const refunded = repayment.closure?.refunded;
          return (
            <RowWithDetails
              key={repayment.repaymentId ?? index}
              colSpan={5}
              cells={
                <>
                  <Table.Td>
                    {repayment.valueDate === undefined ? null : <BusinessDate value={repayment.valueDate} />}
                  </Table.Td>
                  <Table.Td>{intl.formatMessage(repaymentKindName(repayment.kind))}</Table.Td>
                  <Table.Td className="finapp-cell-amount" td={reversed ? 'line-through' : undefined}>
                    <MaybeMoney amount={repayment.amount} currency={own} />
                  </Table.Td>
                  <Table.Td>
                    <StatusChip value={repayment.status ?? ''} map={REPAYMENT_STATUS} />
                  </Table.Td>
                </>
              }
              details={
                <Stack gap="xs">
                  {allocations.length === 0 ? (
                    <Text size="sm">{intl.formatMessage(messages.noBreakdown)}</Text>
                  ) : (
                    <>
                      <Text size="sm" fw={600}>
                        {intl.formatMessage(reversed ? messages.breakdownReversed : messages.breakdown)}
                      </Text>
                      <dl className="finapp-review">
                        {allocations.map((allocation, at) => (
                          // Each line as finapp returned it, in its order; two lines of one kind stay two lines.
                          <div key={at} className="finapp-review__row">
                            <dt>{intl.formatMessage(allocationName(allocation))}</dt>
                            <dd>
                              <MaybeMoney amount={allocation.amount} currency={own} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                  {refunded === undefined || own === '' ? null : (
                    <Text size="sm">{intl.formatMessage(refundMessage, { amount: text.money(refunded, own) })}</Text>
                  )}
                </Stack>
              }
            />
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

/** A default is a fact on the account; finapp's bucket is never shown. */
export function DefaultedNotice({ defaulted }: { defaulted: boolean | undefined }) {
  const intl = useIntl();
  if (defaulted !== true) return null;
  return <Alert color="orange" title={intl.formatMessage(messages.defaulted)} />;
}

export function PayoutNotice({ status }: { status: string }) {
  return (
    <Text>
      <FormattedMessage {...payoutWords(status)} />
    </Text>
  );
}
