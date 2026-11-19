// Move money (blueprint §6): the ways money leaves or enters the customer's wallet, each one journey. Only the
// journeys finapp serves are offered.
import { Card, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import {
  IconArrowsExchange,
  IconBuildingBank,
  IconChevronRight,
  IconCreditCard,
  IconSend,
  IconUsers,
  IconWorld,
  type Icon,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, type MessageDescriptor } from 'react-intl';

const messages = defineMessages({
  title: { id: 'move.title', defaultMessage: 'Move money' },
  send: { id: 'move.send', defaultMessage: 'Send to someone at FinApp' },
  sendBody: { id: 'move.send.body', defaultMessage: 'Instantly, from your wallet to theirs.' },
  recipients: { id: 'move.recipients', defaultMessage: 'Your recipients' },
  recipientsBody: { id: 'move.recipients.body', defaultMessage: 'People and accounts you send to.' },
  topUp: { id: 'move.topUp', defaultMessage: 'Add money' },
  topUpBody: { id: 'move.topUp.body', defaultMessage: 'Top up your wallet with a saved card or bank account.' },
  withdraw: { id: 'move.withdraw', defaultMessage: 'Withdraw to your bank' },
  withdrawBody: { id: 'move.withdraw.body', defaultMessage: 'Send money from your wallet to your own bank account.' },
  exchange: { id: 'move.exchange', defaultMessage: 'Exchange currencies' },
  exchangeBody: {
    id: 'move.exchange.body',
    defaultMessage: 'Convert between the currencies in your wallet at a quoted rate.',
  },
  abroad: { id: 'move.abroad', defaultMessage: 'Send abroad' },
  abroadBody: {
    id: 'move.abroad.body',
    defaultMessage: 'Pay someone in another country, with the fee and rate shown first.',
  },
  methods: { id: 'move.methods', defaultMessage: 'Cards and bank accounts' },
  methodsBody: {
    id: 'move.methods.body',
    defaultMessage: 'The cards and bank accounts you add money from or withdraw to.',
  },
});

const JOURNEYS: ReadonlyArray<{ to: string; icon: Icon; title: MessageDescriptor; body: MessageDescriptor }> = [
  { to: '/move/send', icon: IconSend, title: messages.send, body: messages.sendBody },
  { to: '/move/top-up', icon: IconCreditCard, title: messages.topUp, body: messages.topUpBody },
  { to: '/move/withdraw', icon: IconBuildingBank, title: messages.withdraw, body: messages.withdrawBody },
  { to: '/exchange', icon: IconArrowsExchange, title: messages.exchange, body: messages.exchangeBody },
  { to: '/send-abroad', icon: IconWorld, title: messages.abroad, body: messages.abroadBody },
  { to: '/move/recipients', icon: IconUsers, title: messages.recipients, body: messages.recipientsBody },
  { to: '/move/payment-methods', icon: IconCreditCard, title: messages.methods, body: messages.methodsBody },
];

export function MoveMoneyPage() {
  return (
    <Stack gap="md">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      {JOURNEYS.map((journey) => (
        <UnstyledButton
          key={journey.to}
          renderRoot={(props) => <Link {...props} to={journey.to} />}
          className="finapp-entry"
        >
          <Card withBorder radius="md" padding="lg">
            <div className="finapp-entry__row">
              <journey.icon aria-hidden />
              <Stack gap={2} className="finapp-entry__text">
                <Text fw={600}>
                  <FormattedMessage {...journey.title} />
                </Text>
                <Text size="sm" c="dimmed">
                  <FormattedMessage {...journey.body} />
                </Text>
              </Stack>
              <IconChevronRight aria-hidden />
            </div>
          </Card>
        </UnstyledButton>
      ))}
    </Stack>
  );
}
