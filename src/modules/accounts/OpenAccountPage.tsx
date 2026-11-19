// Open an account (P18-TSK-018): a wallet in a first currency, under an idempotency key. finapp decides who
// may open one (a verified identity among other things) and answers with a reason the customer can act on.
import { Button, Select, Stack, Text, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, UnknownOutcome } from '../../design-system/States.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ACCOUNTS_ROOT } from './api.ts';
import { currencyOptions } from './currencies.ts';

const messages = defineMessages({
  title: { id: 'openAccount.title', defaultMessage: 'Open a wallet' },
  lead: {
    id: 'openAccount.lead',
    defaultMessage: 'A wallet holds money in one or more currencies. Choose the first one; you can add others later.',
  },
  currency: { id: 'openAccount.currency', defaultMessage: 'Currency' },
  chooseCurrency: { id: 'openAccount.chooseCurrency', defaultMessage: 'Choose a currency.' },
  open: { id: 'openAccount.open', defaultMessage: 'Open wallet' },
  cancel: { id: 'openAccount.cancel', defaultMessage: 'Cancel' },
});

interface OpenRequest {
  productType: 'WALLET';
  currency: string;
}

export function OpenAccountPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const options = useMemo(() => currencyOptions(intl.locale), [intl.locale]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | undefined>();
  const open = useCommand(
    async (intent: IdempotencyIntent<OpenRequest>) =>
      ok(api.POST('/v1/me/accounts', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { invalidate: [ACCOUNTS_ROOT], routeId: '/accounts/open' },
  );

  const submit = async () => {
    if (currency === null) return setProblem(intl.formatMessage(messages.chooseCurrency));
    setProblem(undefined);
    const result = await open.submit({ productType: 'WALLET', currency });
    if (result?.status === 'succeeded' && result.data.id !== undefined) {
      await navigate({ to: '/accounts/$accountId', params: { accountId: result.data.id } });
    }
  };

  const failure = failureOf(open.state);
  return (
    <Stack gap="lg" maw={480}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text>
        <FormattedMessage {...messages.lead} />
      </Text>
      {failure === undefined ? null : failure.status === 'unknown' ? (
        <UnknownOutcome
          correlationId={failure.error.correlationId}
          onCheck={() => void navigate({ to: '/accounts' })}
          onSendSame={() => void submit()}
        />
      ) : (
        <ErrorExplained error={failure.error} />
      )}
      <Select
        label={intl.formatMessage(messages.currency)}
        data={options}
        value={currency}
        onChange={setCurrency}
        error={problem}
        comboboxProps={{ withinPortal: false }}
      />
      <Stack gap="xs" align="flex-start">
        <Button onClick={() => void submit()} loading={open.state.status === 'sending'}>
          <FormattedMessage {...messages.open} />
        </Button>
        <Link to="/accounts">
          <FormattedMessage {...messages.cancel} />
        </Link>
      </Stack>
    </Stack>
  );
}
