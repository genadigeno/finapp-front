// One account (P18-TSK-018): its balance in every currency it holds - available first, settled and on-hold
// labelled beside it, never summed (ADR-0009, ADR-F04) - adding a currency, the statement, and closing it.
// Whether an account can close (empty, nothing held) is finapp's to decide; the confirmation says what closing
// means and finapp says when it cannot.
import { Button, Card, Group, Select, Stack, Text, Title } from '@mantine/core';
import { IconFileText, IconPlus } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState, UnknownOutcome } from '../../design-system/States.tsx';
import { BalanceTriplet, StatusChip } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT, useAccounts, useBalances } from './api.ts';
import { currencyOptions } from './currencies.ts';
import { ACCOUNT_STATUS, productName, SUPPORTED_CURRENCIES } from './labels.ts';

const messages = defineMessages({
  back: { id: 'account.back', defaultMessage: 'All accounts' },
  statement: { id: 'account.statement', defaultMessage: 'Statement' },
  noBalance: { id: 'account.noBalance', defaultMessage: 'This account holds no money yet.' },
  addTitle: { id: 'account.add.title', defaultMessage: 'Hold another currency' },
  currency: { id: 'account.add.currency', defaultMessage: 'Currency' },
  add: { id: 'account.add', defaultMessage: 'Add currency' },
  chooseCurrency: { id: 'account.add.choose', defaultMessage: 'Choose a currency.' },
  added: { id: 'account.added', defaultMessage: 'Added. Its balance appears above.' },
  close: { id: 'account.close', defaultMessage: 'Close this account' },
  closeTitle: { id: 'account.close.title', defaultMessage: 'Close this account?' },
  closeBody: {
    id: 'account.close.body',
    defaultMessage:
      'Move all money out first: an account that still holds money, or has payments in progress, cannot be closed. Closing cannot be undone.',
  },
  closed: { id: 'account.closed', defaultMessage: 'This account is closed.' },
  notFound: { id: 'account.notFound', defaultMessage: 'We could not find this account.' },
});

function AddCurrency({ accountId, held }: { accountId: string; held: readonly string[] }) {
  const intl = useIntl();
  const api = useApi();
  const options = useMemo(() => currencyOptions(intl.locale, held), [intl.locale, held]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | undefined>();
  const [added, setAdded] = useState(false);
  const add = useCommand(
    async (intent: IdempotencyIntent<{ currency: string }>) =>
      ok(
        api.POST('/v1/me/accounts/{id}/currencies', {
          params: { path: { id: accountId }, header: intent.headers() },
          body: { ...intent.body },
        }),
      ),
    { invalidate: [ACCOUNTS_ROOT], routeId: '/accounts/$accountId' },
  );
  const failure = failureOf(add.state);
  const submit = async () => {
    setAdded(false);
    if (currency === null) return setProblem(intl.formatMessage(messages.chooseCurrency));
    setProblem(undefined);
    const result = await add.submit({ currency });
    if (result?.status === 'succeeded') {
      setAdded(true);
      setCurrency(null);
    }
  };
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack>
        <Title order={2}>
          <FormattedMessage {...messages.addTitle} />
        </Title>
        <Group align="flex-end" wrap="wrap">
          <Select
            label={intl.formatMessage(messages.currency)}
            data={options}
            value={currency}
            onChange={setCurrency}
            error={problem}
            comboboxProps={{ withinPortal: false }}
          />
          <Button
            variant="default"
            leftSection={<IconPlus size={18} aria-hidden />}
            onClick={() => void submit()}
            loading={add.state.status === 'sending'}
          >
            <FormattedMessage {...messages.add} />
          </Button>
        </Group>
        {failure === undefined ? null : failure.status === 'unknown' ? (
          <UnknownOutcome correlationId={failure.error.correlationId} onSendSame={() => void submit()} />
        ) : (
          <ErrorExplained error={failure.error} />
        )}
        {added ? (
          <Text c="teal" role="status">
            <FormattedMessage {...messages.added} />
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}

export function AccountPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const { accountId } = useParams({ strict: false }) as { accountId: string };
  const accounts = useAccounts();
  const balances = useBalances(accountId);
  const [confirming, setConfirming] = useState(false);
  const close = useCommand(
    async () => ok(api.DELETE('/v1/me/accounts/{id}', { params: { path: { id: accountId } } })),
    { invalidate: [ACCOUNTS_ROOT], routeId: '/accounts/$accountId' },
  );

  if (accounts.isPending || balances.isPending) return <LoadingState />;
  if (accounts.isError) return <ErrorExplained error={accounts.error} onRetry={() => void accounts.refetch()} />;
  const account = accounts.data.find((a) => a.id === accountId);
  // Not in the customer's own list: finapp answers "not yours" as not found, and so does this page.
  if (account === undefined) {
    return (
      <Stack gap="sm">
        <Text>
          <FormattedMessage {...messages.notFound} />
        </Text>
        <Link to="/accounts">
          <FormattedMessage {...messages.back} />
        </Link>
      </Stack>
    );
  }
  const closed = account.status === 'CLOSED';
  const held = balances.data?.lines.map((line) => line.currency) ?? [];
  const closeFailure = failureOf(close.state);

  return (
    <Stack gap="lg">
      <Link to="/accounts">
        <FormattedMessage {...messages.back} />
      </Link>
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Title order={1}>{intl.formatMessage(productName(account.productType))}</Title>
          {account.status === undefined ? null : <StatusChip value={account.status} map={ACCOUNT_STATUS} />}
        </Group>
        <Button
          variant="default"
          leftSection={<IconFileText size={18} aria-hidden />}
          renderRoot={(props) => <Link {...props} to="/accounts/$accountId/statement" params={{ accountId }} />}
        >
          <FormattedMessage {...messages.statement} />
        </Button>
      </Group>
      {balances.isError ? (
        <ErrorExplained error={balances.error} onRetry={() => void balances.refetch()} />
      ) : balances.data.lines.length === 0 ? (
        <Text c="dimmed">
          <FormattedMessage {...messages.noBalance} />
        </Text>
      ) : (
        balances.data.lines.map((line) => (
          <Card key={line.currency} withBorder radius="md" padding="lg">
            <BalanceTriplet
              currency={line.currency}
              available={line.available}
              settled={line.settled}
              holds={line.holds}
              asOf={balances.data.readAt}
            />
          </Card>
        ))
      )}
      {closed ? (
        <Text c="dimmed">
          <FormattedMessage {...messages.closed} />
        </Text>
      ) : (
        <>
          {held.length < SUPPORTED_CURRENCIES.length ? <AddCurrency accountId={accountId} held={held} /> : null}
          {closeFailure === undefined ? null : <ErrorExplained error={closeFailure.error} />}
          <div>
            <Button variant="subtle" color="red" onClick={() => setConfirming(true)}>
              <FormattedMessage {...messages.close} />
            </Button>
          </div>
        </>
      )}
      <ConfirmDangerous
        opened={confirming}
        title={intl.formatMessage(messages.closeTitle)}
        confirmLabel={intl.formatMessage(messages.close)}
        busy={close.state.status === 'sending'}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          void close.submit({}).then((result) => {
            setConfirming(false);
            if (result?.status === 'succeeded') void navigate({ to: '/accounts' });
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
