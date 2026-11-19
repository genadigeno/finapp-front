// The start page: what FinApp is, and the two ways in (P18-TSK-010, -011).
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useReturnTo } from '../../platform/return-to.ts';

const messages = defineMessages({
  title: { id: 'welcome.title', defaultMessage: 'Welcome to FinApp' },
  lead: {
    id: 'welcome.lead',
    defaultMessage: 'Hold money in several currencies, move it safely, and keep track of what you owe and own.',
  },
  signIn: { id: 'welcome.signIn', defaultMessage: 'Sign in' },
  register: { id: 'welcome.register', defaultMessage: 'Open an account' },
});

export function WelcomePage() {
  const returnTo = useReturnTo();
  return (
    <Stack gap="md">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text size="lg">
        <FormattedMessage {...messages.lead} />
      </Text>
      <Group>
        <Button
          renderRoot={(props) => <Link {...props} to="/sign-in" search={returnTo === undefined ? {} : { returnTo }} />}
        >
          <FormattedMessage {...messages.signIn} />
        </Button>
        <Button component={Link} to="/register" variant="default">
          <FormattedMessage {...messages.register} />
        </Button>
      </Group>
    </Stack>
  );
}
