// The signed-in home page: a greeting, the customer's own reference, and the onboarding checklist
// (P18-TSK-016), and - once the customer holds an account - their money (P18-TSK-017).
import { Stack, Text, Title } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { defineMessage, defineMessages, FormattedMessage } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { useStanding } from '../../platform/session/standing.ts';

// The checklist is the onboarding module's; loaded with the page, not in the entry chunk.
const OnboardingChecklist = lazy(() =>
  import('../../modules/onboarding/OnboardingChecklist.tsx').then((m) => ({ default: m.OnboardingChecklist })),
);

const AccountsSummary = lazy(() =>
  import('../../modules/accounts/AccountsSummary.tsx').then((m) => ({ default: m.AccountsSummary })),
);

const messages = defineMessages({
  title: { id: 'home.title', defaultMessage: 'Home' },
  business: { id: 'home.business', defaultMessage: 'You are signed in for your business.' },
  reference: { id: 'home.reference', defaultMessage: 'Your customer reference' },
  referenceHint: {
    id: 'home.reference.hint',
    defaultMessage: 'Share it only with a business that needs to declare you as an owner or controller.',
  },
});

const greetingMessage = defineMessage<{ name: string }>({ id: 'home.greeting', defaultMessage: 'Hello, {name}' });

export function HomePage() {
  const standing = useStanding();
  if (standing.isPending) return <LoadingState />;
  if (standing.isError) return <ErrorExplained error={standing.error} onRetry={() => void standing.refetch()} />;
  const { displayName, partyKind, partyId } = standing.data;
  return (
    <Stack gap="xl">
      <Stack gap="xs">
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
      <Suspense fallback={<LoadingState />}>
        <AccountsSummary />
        <OnboardingChecklist />
      </Suspense>
      {partyId === undefined ? null : (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            <FormattedMessage {...messages.reference} />
          </Text>
          <Text className="finapp-mono">{partyId}</Text>
          <Text size="sm" c="dimmed">
            <FormattedMessage {...messages.referenceHint} />
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
