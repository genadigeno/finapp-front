// The dashboard's money (P18-TSK-017): each account's available balance in each currency, as finapp projects
// it, with when it was read. Nothing is converted or totalled across currencies or accounts (ADR-F04). Shown on
// Home only when the customer has an account; onboarding stays the first thing otherwise.
import { Card, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { formatInstant } from '../../design-system/dates.ts';
import { ErrorExplained } from '../../design-system/States.tsx';
import { Money } from '../../design-system/Values.tsx';
import { useAccounts, useBalances, type Account } from './api.ts';
import { isLive, productName } from './labels.ts';

const messages = defineMessages({
  title: { id: 'dashboard.money', defaultMessage: 'Your money' },
  all: { id: 'dashboard.allAccounts', defaultMessage: 'All accounts' },
  nothing: { id: 'dashboard.nothing', defaultMessage: 'No money held yet' },
});

const asOfMessage = defineMessage<{ time: string }>({
  id: 'dashboard.asOf',
  defaultMessage: 'Available, as of {time}',
});

function AccountMoney({ account }: { account: Account }) {
  const intl = useIntl();
  const balances = useBalances(account.id);
  return (
    <UnstyledButton
      renderRoot={(props) => <Link {...props} to="/accounts/$accountId" params={{ accountId: account.id }} />}
      className="finapp-entry"
    >
      <Card withBorder radius="md" padding="md">
        <div className="finapp-entry__row">
          <Stack gap={4} className="finapp-entry__text">
            <Text fw={600}>{intl.formatMessage(productName(account.productType))}</Text>
            {balances.isError ? (
              <ErrorExplained error={balances.error} />
            ) : balances.data === undefined ? null : balances.data.lines.length === 0 ? (
              <Text size="sm" c="dimmed">
                <FormattedMessage {...messages.nothing} />
              </Text>
            ) : (
              <>
                <Group gap="lg">
                  {balances.data.lines.map((line) => (
                    <Money key={line.currency} amount={line.available} currency={line.currency} size="lg" />
                  ))}
                </Group>
                <Text size="xs" c="dimmed">
                  {intl.formatMessage(asOfMessage, {
                    time: ((t) => (t.valid ? t.text : t.raw))(formatInstant(balances.data.readAt, intl.locale)),
                  })}
                </Text>
              </>
            )}
          </Stack>
          <IconChevronRight aria-hidden />
        </div>
      </Card>
    </UnstyledButton>
  );
}

/** Renders nothing while loading or when the customer has no account. */
export function AccountsSummary() {
  const accounts = useAccounts();
  if (accounts.isError) return <ErrorExplained error={accounts.error} onRetry={() => void accounts.refetch()} />;
  if (accounts.data === undefined || accounts.data.length === 0) return null;
  const open = accounts.data.filter((a) => isLive(a.status));
  if (open.length === 0) return null;
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={2}>
          <FormattedMessage {...messages.title} />
        </Title>
        <Link to="/accounts">
          <FormattedMessage {...messages.all} />
        </Link>
      </Group>
      {open.map((account) => (
        <AccountMoney key={account.id} account={account} />
      ))}
    </Stack>
  );
}
