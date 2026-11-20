// The start page: what FinApp is, and the two ways in (P18-TSK-010, -011). It travels with the entry (route-table.ts),
// so it stays small. Every statement on it describes something the application does today.
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowsExchange, IconFileText, IconWallet, type Icon } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { defineMessages, FormattedMessage, type MessageDescriptor } from 'react-intl';
import { useReturnTo } from '../../platform/return-to.ts';

const messages = defineMessages({
  eyebrow: { id: 'welcome.eyebrow', defaultMessage: 'Personal finance, plainly' },
  title: { id: 'welcome.title', defaultMessage: 'Welcome to FinApp' },
  lead: {
    id: 'welcome.lead',
    defaultMessage: 'Hold money in several currencies, move it safely, and keep track of what you owe and own.',
  },
  signIn: { id: 'welcome.signIn', defaultMessage: 'Sign in' },
  register: { id: 'welcome.register', defaultMessage: 'Open an account' },
  wallets: { id: 'welcome.wallets', defaultMessage: 'Several currencies, one wallet' },
  walletsBody: {
    id: 'welcome.wallets.body',
    defaultMessage: 'Each currency keeps its own balance - available, settled and on hold, always as of a time.',
  },
  rates: { id: 'welcome.rates', defaultMessage: 'Rates and fees up front' },
  ratesBody: {
    id: 'welcome.rates.body',
    defaultMessage: 'See the rate, our margin and every fee before you confirm an exchange or a payment abroad.',
  },
  credit: { id: 'welcome.credit', defaultMessage: 'Credit with clear terms' },
  creditBody: {
    id: 'welcome.credit.body',
    defaultMessage: 'Read the agreement, the schedule and the total to repay before you accept anything.',
  },
});

const FEATURES: ReadonlyArray<{ icon: Icon; title: MessageDescriptor; body: MessageDescriptor }> = [
  { icon: IconWallet, title: messages.wallets, body: messages.walletsBody },
  { icon: IconArrowsExchange, title: messages.rates, body: messages.ratesBody },
  { icon: IconFileText, title: messages.credit, body: messages.creditBody },
];

export function WelcomePage() {
  const returnTo = useReturnTo();
  return (
    <Stack gap="xl">
      <Stack gap="md" className="finapp-hero">
        <Text className="finapp-hero__eyebrow">
          <FormattedMessage {...messages.eyebrow} />
        </Text>
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <Text size="lg" c="dimmed" maw={560}>
          <FormattedMessage {...messages.lead} />
        </Text>
        <Group mt="xs">
          <Button
            size="md"
            renderRoot={(props) => (
              <Link {...props} to="/sign-in" search={returnTo === undefined ? {} : { returnTo }} />
            )}
          >
            <FormattedMessage {...messages.signIn} />
          </Button>
          <Button size="md" component={Link} to="/register" variant="default">
            <FormattedMessage {...messages.register} />
          </Button>
        </Group>
      </Stack>
      <div className="finapp-features">
        {FEATURES.map((feature) => (
          <Card key={feature.title.id} withBorder radius="lg" padding="lg">
            <Stack gap="sm">
              <span className="finapp-feature__icon">
                <feature.icon size={20} aria-hidden />
              </span>
              <Title order={2} size="h3">
                <FormattedMessage {...feature.title} />
              </Title>
              <Text size="sm" c="dimmed">
                <FormattedMessage {...feature.body} />
              </Text>
            </Stack>
          </Card>
        ))}
      </div>
    </Stack>
  );
}
