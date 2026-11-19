// Cards and bank accounts (P18-TSK-023): the payment methods finapp holds for the customer, with a way to remove
// one. Adding is not offered: finapp takes a card only as a payment provider's token and a bank account only as a
// provider's single-use linking grant, and gives the browser no way to obtain either (G-10, G-19). The page says
// so instead of a form that could never work.
import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconBuildingBank, IconCreditCard } from '@tabler/icons-react';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { PAYMENT_METHODS_ROOT, usePaymentMethods, type PaymentMethod } from './api.ts';
import { methodKind, payeeCheckWords } from './labels.ts';

const messages = defineMessages({
  title: { id: 'methods.title', defaultMessage: 'Cards and bank accounts' },
  empty: { id: 'methods.empty', defaultMessage: 'No cards or bank accounts yet' },
  cannotAdd: {
    id: 'methods.cannotAdd',
    defaultMessage:
      'Adding a card or linking a bank account is not available here yet. Cards and bank accounts you already hold with us are listed below.',
  },
  remove: { id: 'methods.remove', defaultMessage: 'Remove' },
  removeTitle: { id: 'methods.remove.title', defaultMessage: 'Remove this payment method?' },
  removeBody: {
    id: 'methods.remove.body',
    defaultMessage:
      'You will not be able to add money from it or withdraw to it. Payments already made are not affected.',
  },
});

const suffixMessage = defineMessage<{ suffix: string }>({ id: 'methods.suffix', defaultMessage: 'ending {suffix}' });
const expiryMessage = defineMessage<{ month: string; year: string }>({
  id: 'methods.expiry',
  defaultMessage: 'expires {month}/{year}',
});

function MethodRow({ method }: { method: PaymentMethod }) {
  const intl = useIntl();
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const remove = useCommand(
    async (intent: { body: { id: string } }) =>
      ok(api.DELETE('/v1/me/payment-methods/{id}', { params: { path: { id: intent.body.id } } })),
    { invalidate: [PAYMENT_METHODS_ROOT], routeId: '/move/payment-methods' },
  );
  const failure = failureOf(remove.state);
  const payee = payeeCheckWords(method.payeeCheck);
  const Icon = method.kind === 'CARD_TOKEN' ? IconCreditCard : IconBuildingBank;
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <Icon aria-hidden />
            <Stack gap={2}>
              <Text fw={600}>
                {method.brand ?? intl.formatMessage(methodKind(method.kind))}
                {method.displaySuffix === undefined
                  ? null
                  : ` ${intl.formatMessage(suffixMessage, { suffix: method.displaySuffix })}`}
              </Text>
              {method.expiryMonth === undefined || method.expiryYear === undefined ? null : (
                <Text size="sm" c="dimmed">
                  {intl.formatMessage(expiryMessage, {
                    month: String(method.expiryMonth).padStart(2, '0'),
                    year: String(method.expiryYear),
                  })}
                </Text>
              )}
              {payee === undefined ? null : (
                <Text size="sm" c="dimmed">
                  <FormattedMessage {...payee} />
                </Text>
              )}
            </Stack>
          </Group>
          <Button variant="subtle" color="red" onClick={() => setConfirming(true)}>
            <FormattedMessage {...messages.remove} />
          </Button>
        </Group>
        {failure === undefined ? null : <ErrorExplained error={failure.error} />}
      </Stack>
      <ConfirmDangerous
        opened={confirming}
        title={intl.formatMessage(messages.removeTitle)}
        confirmLabel={intl.formatMessage(messages.remove)}
        busy={remove.state.status === 'sending'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove.submit({ id: method.id }).finally(() => setConfirming(false))}
      >
        <Text>
          <FormattedMessage {...messages.removeBody} />
        </Text>
      </ConfirmDangerous>
    </Card>
  );
}

export function PaymentMethodsPage() {
  const intl = useIntl();
  const methods = usePaymentMethods();
  return (
    <Stack gap="lg">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Alert variant="light" color="gray">
        <FormattedMessage {...messages.cannotAdd} />
      </Alert>
      {methods.isPending ? (
        <LoadingState />
      ) : methods.isError ? (
        <ErrorExplained error={methods.error} onRetry={() => void methods.refetch()} />
      ) : methods.data.length === 0 ? (
        <EmptyState title={intl.formatMessage(messages.empty)} />
      ) : (
        methods.data.map((method) => <MethodRow key={method.id} method={method} />)
      )}
    </Stack>
  );
}
