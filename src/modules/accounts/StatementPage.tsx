// An account statement for a period (P18-TSK-019): per currency, the opening and closing balances finapp states
// and every entry between them in finapp's order. Dates are business dates, shown as given; amounts carry their
// direction in words. Nothing is totalled here - the opening and closing are finapp's.
import { Alert, Button, Card, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { BusinessDate, Money, SignedMoney } from '../../design-system/Values.tsx';
import { useStatement, type StatementLine } from './api.ts';
import { directionOf, lineName } from './labels.ts';
import { calendarDate, checkPeriod, currentMonth, type PeriodProblem } from './period.ts';

const messages = defineMessages({
  title: { id: 'statement.title', defaultMessage: 'Statement' },
  back: { id: 'statement.back', defaultMessage: 'Back to the account' },
  from: { id: 'statement.from', defaultMessage: 'From' },
  to: { id: 'statement.to', defaultMessage: 'To' },
  show: { id: 'statement.show', defaultMessage: 'Show statement' },
  opening: { id: 'statement.opening', defaultMessage: 'Opening balance' },
  closing: { id: 'statement.closing', defaultMessage: 'Closing balance' },
  date: { id: 'statement.date', defaultMessage: 'Date' },
  description: { id: 'statement.description', defaultMessage: 'Description' },
  amount: { id: 'statement.amount', defaultMessage: 'Amount' },
  empty: { id: 'statement.empty', defaultMessage: 'No entries in this period' },
  invalid: { id: 'statement.invalid', defaultMessage: 'Enter both dates.' },
  order: { id: 'statement.order', defaultMessage: 'The start date must be on or before the end date.' },
  future: { id: 'statement.future', defaultMessage: 'The end date cannot be in the future.' },
  noSections: { id: 'statement.noSections', defaultMessage: 'This account held no money in this period.' },
  valueDate: { id: 'statement.valueDate', defaultMessage: 'Value date' },
});

const PROBLEMS: Record<PeriodProblem, keyof typeof messages> = { invalid: 'invalid', order: 'order', future: 'future' };

function Line({ line, currency }: { line: StatementLine; currency: string }) {
  const intl = useIntl();
  const direction = directionOf(line.direction);
  return (
    <Table.Tr>
      <Table.Td>{line.postingDate === undefined ? '-' : <BusinessDate value={line.postingDate} />}</Table.Td>
      <Table.Td>
        <Text size="sm">
          {((name) => (typeof name === 'string' ? name : intl.formatMessage(name)))(
            lineName(line.entryType, line.label),
          )}
        </Text>
        {line.reference === undefined ? null : (
          <Text size="xs" c="dimmed" className="finapp-mono">
            {line.reference}
          </Text>
        )}
        {line.valueDate !== undefined && line.valueDate !== line.postingDate ? (
          <Text size="xs" c="dimmed">
            <FormattedMessage {...messages.valueDate} />: <BusinessDate value={line.valueDate} />
          </Text>
        ) : null}
      </Table.Td>
      <Table.Td className="finapp-cell-amount">
        {direction === undefined ? (
          <Money amount={line.amount} currency={currency} />
        ) : (
          <SignedMoney amount={line.amount} currency={currency} direction={direction} />
        )}
      </Table.Td>
    </Table.Tr>
  );
}

export function StatementPage() {
  const intl = useIntl();
  const { accountId } = useParams({ strict: false }) as { accountId: string };
  const [draft, setDraft] = useState(() => currentMonth(new Date()));
  const [period, setPeriod] = useState(draft);
  const [problem, setProblem] = useState<PeriodProblem | undefined>();
  const statement = useStatement(accountId, period);

  const show = (event: FormEvent) => {
    event.preventDefault();
    const found = checkPeriod(draft.from, draft.to, calendarDate(new Date()));
    setProblem(found);
    if (found === undefined) setPeriod(draft);
  };

  return (
    <Stack gap="lg">
      <Link to="/accounts/$accountId" params={{ accountId }}>
        <FormattedMessage {...messages.back} />
      </Link>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <form onSubmit={show} noValidate>
        <Group align="flex-end" wrap="wrap">
          <TextInput
            type="date"
            label={intl.formatMessage(messages.from)}
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.currentTarget.value })}
          />
          <TextInput
            type="date"
            label={intl.formatMessage(messages.to)}
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value })}
          />
          <Button type="submit" variant="default">
            <FormattedMessage {...messages.show} />
          </Button>
        </Group>
        {problem === undefined ? null : (
          <Text c="red" role="alert" mt="xs">
            {intl.formatMessage(messages[PROBLEMS[problem]])}
          </Text>
        )}
      </form>
      {statement.isPending ? (
        <LoadingState />
      ) : statement.isError ? (
        <ErrorExplained error={statement.error} onRetry={() => void statement.refetch()} />
      ) : statement.data.length === 0 ? (
        <Alert variant="light" color="gray">
          <FormattedMessage {...messages.noSections} />
        </Alert>
      ) : (
        statement.data.map((section) => (
          <Card key={section.currency} withBorder radius="md" padding="lg">
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <Title order={2}>{section.currency}</Title>
                {section.opening === undefined ? null : (
                  <Text size="sm">
                    <FormattedMessage {...messages.opening} />:{' '}
                    <Money amount={section.opening} currency={section.currency} />
                  </Text>
                )}
              </Group>
              {section.lines.length === 0 ? (
                <EmptyState title={intl.formatMessage(messages.empty)} />
              ) : (
                <div className="finapp-table-scroll">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <FormattedMessage {...messages.date} />
                        </Table.Th>
                        <Table.Th>
                          <FormattedMessage {...messages.description} />
                        </Table.Th>
                        <Table.Th className="finapp-cell-amount">
                          <FormattedMessage {...messages.amount} />
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {section.lines.map((line, index) => (
                        <Line key={line.entryId ?? index} line={line} currency={section.currency} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              )}
              {section.closing === undefined ? null : (
                <Text size="sm" ta="right">
                  <FormattedMessage {...messages.closing} />:{' '}
                  <Money amount={section.closing} currency={section.currency} />
                </Text>
              )}
            </Stack>
          </Card>
        ))
      )}
    </Stack>
  );
}
