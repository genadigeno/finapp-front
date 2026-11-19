// Pieces the credit pages share: a list of facts, the offer document, an illustrated schedule, the reasons finapp
// gives a customer, and the way to consent when finapp asks for it.
import { Anchor, List, Stack, Table, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { formatBusinessDate, formatInstant } from '../../design-system/dates.ts';
import { formatMoney, fractionToPercent } from '../../design-system/money.ts';
import { BusinessDate, Money } from '../../design-system/Values.tsx';
import { ApiError } from '../../platform/api/api-error.ts';

const messages = defineMessages({
  document: { id: 'credit.document', defaultMessage: 'Credit agreement' },
  dueDate: { id: 'credit.schedule.dueDate', defaultMessage: 'Due' },
  instalment: { id: 'credit.schedule.instalment', defaultMessage: 'Payment' },
  principal: { id: 'credit.schedule.principal', defaultMessage: 'Of which borrowed' },
  interest: { id: 'credit.schedule.interest', defaultMessage: 'Of which interest' },
  reasons: { id: 'credit.reasons', defaultMessage: 'What we can tell you about this decision:' },
  consent: { id: 'credit.consent', defaultMessage: 'Give your consent to check your credit history' },
});

const rateMessage = defineMessage<{ percent: string }>({
  id: 'credit.rate',
  defaultMessage: '{percent}% a year (fixed)',
});

export interface Fact {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}

/** Labelled figures, read in order (the review panel's list, without a command). */
export function Facts({ rows }: { rows: readonly Fact[] }) {
  return (
    <dl className="finapp-review">
      {rows.map((row) => (
        <div key={row.label} className="finapp-review__row" data-emphasis={row.emphasis || undefined}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A nominal annual rate finapp sends as a fraction ("0.0790"), as a percentage by moving the decimal point. */
export function AnnualRate({ fraction }: { fraction: string | undefined }) {
  const intl = useIntl();
  if (fraction === undefined) return null;
  const percent = fractionToPercent(fraction);
  return <>{percent === undefined ? fraction : intl.formatMessage(rateMessage, { percent })}</>;
}

/** Money when finapp sent both parts, nothing otherwise. */
export function MaybeMoney({ amount, currency }: { amount: string | undefined; currency: string | undefined }) {
  if (amount === undefined || currency === undefined) return null;
  return <Money amount={amount} currency={currency} />;
}

/**
 * The agreement text exactly as finapp sent it - the text whose hash the customer accepts. A focusable,
 * scrollable region so it can be read with a keyboard.
 */
export function OfferDocument({ text }: { text: string }) {
  const intl = useIntl();
  return (
    <section className="finapp-document" tabIndex={0} aria-label={intl.formatMessage(messages.document)}>
      <pre>{text}</pre>
    </section>
  );
}

export interface IllustratedPeriod {
  sequence?: number | undefined;
  dueDate?: string | undefined;
  amount?: string | undefined;
  instalment?: string | undefined;
  principal?: string | undefined;
  interest?: string | undefined;
}

/** An illustrated repayment schedule: every row as finapp computed it. */
export function ScheduleTable({ periods, currency }: { periods: readonly IllustratedPeriod[]; currency: string }) {
  const intl = useIntl();
  return (
    <Table.ScrollContainer minWidth={420}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{intl.formatMessage(messages.dueDate)}</Table.Th>
            <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.instalment)}</Table.Th>
            <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.principal)}</Table.Th>
            <Table.Th className="finapp-cell-amount">{intl.formatMessage(messages.interest)}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {periods.map((period, index) => (
            <Table.Tr key={period.sequence ?? index}>
              <Table.Td>{period.dueDate === undefined ? null : <BusinessDate value={period.dueDate} />}</Table.Td>
              <Table.Td className="finapp-cell-amount">
                <MaybeMoney amount={period.instalment ?? period.amount} currency={currency} />
              </Table.Td>
              <Table.Td className="finapp-cell-amount">
                <MaybeMoney amount={period.principal} currency={currency} />
              </Table.Td>
              <Table.Td className="finapp-cell-amount">
                <MaybeMoney amount={period.interest} currency={currency} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/**
 * The reasons finapp gives the customer for a decision - its customer texts, in its order, never a score, a
 * threshold or a risk signal (INV-CRD-02, INV-CRD-04).
 */
export function Reasons({ reasons }: { reasons: readonly string[] | undefined }) {
  if (reasons === undefined || reasons.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="sm">
        <FormattedMessage {...messages.reasons} />
      </Text>
      <List size="sm">
        {reasons.map((reason) => (
          <List.Item key={reason}>{reason}</List.Item>
        ))}
      </List>
    </Stack>
  );
}

/** finapp needs the customer's consent to check their credit history: the way there. */
export function ConsentLink({ error }: { error: unknown }) {
  if (!(error instanceof ApiError) || error.code !== 'consent.ConsentRequired') return null;
  return (
    <Anchor renderRoot={(props) => <Link {...props} to="/onboarding/consents" />}>
      <FormattedMessage {...messages.consent} />
    </Anchor>
  );
}

/**
 * finapp's dates and amounts as text, for a sentence with a placeholder. The same formatting as BusinessDate,
 * Timestamp and Money; an unreadable value is shown as finapp sent it.
 */
export function useValueText() {
  const intl = useIntl();
  return {
    date: (value: string) => {
      const formatted = formatBusinessDate(value, intl.locale);
      return formatted.valid ? formatted.text : formatted.raw;
    },
    instant: (value: string) => {
      const formatted = formatInstant(value, intl.locale);
      return formatted.valid ? formatted.text : formatted.raw;
    },
    money: (amount: string, currency: string) => {
      const formatted = formatMoney(amount, currency, intl.locale);
      return formatted.valid ? formatted.text : formatted.raw;
    },
  };
}
