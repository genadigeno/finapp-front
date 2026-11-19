// The start page. Stage 1 ships the foundation only: signing in arrives with Stage 2 (P18-TSK-010), so
// this page says so plainly and offers nothing it cannot do (DOD-CUST).
import { Stack, Text, Title } from '@mantine/core';
import { defineMessages, FormattedMessage } from 'react-intl';

const messages = defineMessages({
  title: { id: 'welcome.title', defaultMessage: 'Welcome to FinApp' },
  lead: {
    id: 'welcome.lead',
    defaultMessage: 'Hold money in several currencies, move it safely, and keep track of what you owe and own.',
  },
  notYet: {
    id: 'welcome.notYet',
    defaultMessage: 'Signing in and opening an account are not available here yet.',
  },
});

export function WelcomePage() {
  return (
    <Stack gap="md">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text size="lg">
        <FormattedMessage {...messages.lead} />
      </Text>
      <Text c="dimmed">
        <FormattedMessage {...messages.notYet} />
      </Text>
    </Stack>
  );
}
