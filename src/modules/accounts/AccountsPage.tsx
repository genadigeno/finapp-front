// Your accounts (P18-TSK-018): every account finapp holds for the customer, each with its balance in every
// currency it holds - as finapp projects it, never summed across currencies or accounts (ADR-F04).
import { Button, Card, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { Money, StatusChip } from '../../design-system/Values.tsx';
import { useAccounts, useBalances, type Account } from './api.ts';
import { ACCOUNT_STATUS, isLive, productName } from './labels.ts';

const messages = defineMessages({
  title: { id: 'accounts.title', defaultMessage: 'Accounts' },
  open: { id: 'accounts.open', defaultMessage: 'Open an account' },
  empty: { id: 'accounts.empty', defaultMessage: 'You have no accounts yet' },
  emptyBody: {
    id: 'accounts.empty.body',
    defaultMessage: 'Open an account to hold money. You need a verified identity first.',
  },
  noBalance: { id: 'accounts.noBalance', defaultMessage: 'No money held yet' },
  balanceFailed: { id: 'accounts.balanceFailed', defaultMessage: 'The balance could not be shown right now.' },
});

function AccountCard({ account }: { account: Account }) {
  const intl = useIntl();
  const balances = useBalances(account.id);
  return (
    <UnstyledButton
      renderRoot={(props) => <Link {...props} to="/accounts/$accountId" params={{ accountId: account.id }} />}
      className="finapp-entry"
    >
      <Card withBorder radius="md" padding="lg">
        <div className="finapp-entry__row">
          <Stack gap={6} className="finapp-entry__text">
            <Group gap="xs">
              <Text fw={600}>{intl.formatMessage(productName(account.productType))}</Text>
              {account.status === undefined ? null : <StatusChip value={account.status} map={ACCOUNT_STATUS} />}
            </Group>
            {balances.isPending ? (
              <Text size="sm" c="dimmed">
                …
              </Text>
            ) : balances.isError ? (
              <Text size="sm" c="dimmed">
                <FormattedMessage {...messages.balanceFailed} />
              </Text>
            ) : balances.data.lines.length === 0 ? (
              <Text size="sm" c="dimmed">
                <FormattedMessage {...messages.noBalance} />
              </Text>
            ) : (
              <Group gap="lg">
                {balances.data.lines.map((line) => (
                  <Money key={line.currency} amount={line.available} currency={line.currency} size="lg" />
                ))}
              </Group>
            )}
          </Stack>
          <IconChevronRight aria-hidden />
        </div>
      </Card>
    </UnstyledButton>
  );
}

export function AccountsPage() {
  const intl = useIntl();
  const accounts = useAccounts();
  if (accounts.isPending) return <LoadingState />;
  if (accounts.isError) return <ErrorExplained error={accounts.error} onRetry={() => void accounts.refetch()} />;
  // finapp allows one live wallet per customer, and a second "open" returns the first unchanged: the way to
  // hold another currency is to add it to the wallet, so Open is offered only when there is none.
  const hasLive = accounts.data.some((a) => isLive(a.status));
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        {hasLive ? null : (
          <Button
            renderRoot={(props) => <Link {...props} to="/accounts/open" />}
            leftSection={<IconPlus size={18} aria-hidden />}
          >
            <FormattedMessage {...messages.open} />
          </Button>
        )}
      </Group>
      {accounts.data.length === 0 ? (
        <EmptyState title={intl.formatMessage(messages.empty)}>
          <FormattedMessage {...messages.emptyBody} />
        </EmptyState>
      ) : (
        accounts.data.map((account) => <AccountCard key={account.id} account={account} />)
      )}
    </Stack>
  );
}
