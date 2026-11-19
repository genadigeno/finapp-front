// The signed-in landing page. In Stage 1 it shows only what finapp already serves for it - the customer's
// own profile (`GET /v1/me`); the dashboard of balances and activity is Stage 3 (P18-TSK-017).
import { Stack, Text, Title } from '@mantine/core';
import { defineMessage, defineMessages, FormattedMessage } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { useStanding } from '../../platform/session/standing.ts';

const messages = defineMessages({
  title: { id: 'home.title', defaultMessage: 'Home' },
  business: { id: 'home.business', defaultMessage: 'You are signed in for your business.' },
});

const greetingMessage = defineMessage<{ name: string }>({ id: 'home.greeting', defaultMessage: 'Hello, {name}' });

export function HomePage() {
  const standing = useStanding();
  if (standing.isPending) return <LoadingState />;
  if (standing.isError) return <ErrorExplained error={standing.error} onRetry={() => void standing.refetch()} />;
  const { displayName, partyKind } = standing.data;
  return (
    <Stack gap="md">
      <Title order={1}>
        {displayName === undefined ? (
          <FormattedMessage {...messages.title} />
        ) : (
          <FormattedMessage {...greetingMessage} values={{ name: displayName }} />
        )}
      </Title>
      {partyKind === 'ORGANISATION' ? (
        <Text>
          <FormattedMessage {...messages.business} />
        </Text>
      ) : null}
    </Stack>
  );
}
