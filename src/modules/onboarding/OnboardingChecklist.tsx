// What the customer still has to do, read from finapp (P18-TSK-016; ADR-F06). Each step's state comes from
// finapp's own reads - consents, the KYC case, the KYB case - never from what this browser remembers.
//
// finapp does not yet say which actions it requires next, or the customer's status (G-08), so this list is
// the steps the customer can take, in order, with finapp's answer for each. Two-step verification has no
// read at all (G-11): it is offered, never marked done.
import { Card, Group, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { IconCircleCheck, IconCircleDashed, IconClock, IconChevronRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { KYC_STATUS } from '../../design-system/status.ts';
import { StatusChip } from '../../design-system/Values.tsx';
import { ApiError } from '../../platform/api/api-error.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { useConsents } from './ConsentsPage.tsx';
import { useKycCase } from './kyc.ts';

const messages = defineMessages({
  title: { id: 'checklist.title', defaultMessage: 'Getting started' },
  identity: { id: 'checklist.identity', defaultMessage: 'Verify your identity' },
  identityTodo: { id: 'checklist.identity.todo', defaultMessage: 'Agree to identity checks and add your documents.' },
  identityConsent: { id: 'checklist.identity.consent', defaultMessage: 'Start by agreeing to identity checks.' },
  identityOpen: { id: 'checklist.identity.open', defaultMessage: 'Add your documents if you have not yet.' },
  identityReview: { id: 'checklist.identity.review', defaultMessage: 'We are reviewing your details.' },
  identityDone: { id: 'checklist.identity.done', defaultMessage: 'Done.' },
  identityAgain: { id: 'checklist.identity.again', defaultMessage: 'We could not verify you. You can try again.' },
  twoStep: { id: 'checklist.twoStep', defaultMessage: 'Protect your account with two-step verification' },
  twoStepBody: { id: 'checklist.twoStep.body', defaultMessage: 'Recommended before you move money.' },
  business: { id: 'checklist.business', defaultMessage: 'Acting for a business?' },
  businessBody: { id: 'checklist.business.body', defaultMessage: 'Register it and declare who owns it.' },
  businessExists: { id: 'checklist.business.exists', defaultMessage: 'Your business' },
  consents: { id: 'checklist.consents', defaultMessage: 'Review your consents' },
  consentsBody: {
    id: 'checklist.consents.body',
    defaultMessage: 'See and change what you allow us to do with your data.',
  },
});

type StepState = 'todo' | 'waiting' | 'done' | 'optional';

const STATE_ICON: Record<StepState, { icon: ReactNode; color: string }> = {
  todo: { icon: <IconCircleDashed size={20} aria-hidden />, color: 'gray' },
  waiting: { icon: <IconClock size={20} aria-hidden />, color: 'blue' },
  done: { icon: <IconCircleCheck size={20} aria-hidden />, color: 'teal' },
  optional: { icon: <IconCircleDashed size={20} aria-hidden />, color: 'gray' },
};

function Step({ to, state, title, children }: { to: string; state: StepState; title: ReactNode; children: ReactNode }) {
  const { icon, color } = STATE_ICON[state];
  return (
    <UnstyledButton component={Link} to={to} className="finapp-entry" data-state={state}>
      <Card withBorder radius="md" padding="md">
        <div className="finapp-entry__row">
          <ThemeIcon variant="light" color={color} radius="xl" size="lg">
            {icon}
          </ThemeIcon>
          <Stack gap={2} className="finapp-entry__text">
            <Text fw={600}>{title}</Text>
            <div>{children}</div>
          </Stack>
          <IconChevronRight aria-hidden />
        </div>
      </Card>
    </UnstyledButton>
  );
}

function useHasBusiness() {
  const api = useApi();
  return useQuery({
    queryKey: ['kyb', 'exists'],
    queryFn: async (): Promise<{ status: string } | null> => {
      try {
        const { data } = await ok(api.GET('/v1/me/kyb'));
        return { status: data.status ?? 'UNKNOWN' };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export function OnboardingChecklist() {
  const intl = useIntl();
  const kyc = useKycCase();
  const consents = useConsents();
  const business = useHasBusiness();

  if (kyc.isPending || consents.isPending || business.isPending) return <LoadingState />;
  const failed = [kyc, consents, business].find((q) => q.isError);
  if (failed?.error) return <ErrorExplained error={failed.error} onRetry={() => void failed.refetch()} />;
  if (kyc.data === undefined || consents.data === undefined || business.data === undefined) return null;

  const consented = consents.data.some((c) => c.purpose === 'KYC_PROCESSING' && c.granted);
  const status = kyc.data.exists ? kyc.data.status : undefined;
  const identityState: StepState =
    status === 'APPROVED' ? 'done' : status === 'IN_PROGRESS' || status === 'PENDING_DECISION' ? 'waiting' : 'todo';
  const identityNote =
    status === undefined
      ? consented
        ? messages.identityTodo
        : messages.identityConsent
      : status === 'APPROVED'
        ? messages.identityDone
        : status === 'REJECTED'
          ? messages.identityAgain
          : status === 'OPEN'
            ? messages.identityOpen
            : messages.identityReview;

  return (
    <Stack gap="sm">
      <Title order={2}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Step to="/onboarding/identity" state={identityState} title={intl.formatMessage(messages.identity)}>
        <Group gap="xs">
          {status === undefined ? null : <StatusChip value={status} map={KYC_STATUS} />}
          <Text size="sm" c="dimmed">
            {intl.formatMessage(identityNote)}
          </Text>
        </Group>
      </Step>
      <Step to="/security/two-step" state="optional" title={intl.formatMessage(messages.twoStep)}>
        <Text size="sm" c="dimmed">
          <FormattedMessage {...messages.twoStepBody} />
        </Text>
      </Step>
      <Step
        to="/business"
        state={business.data === null ? 'optional' : business.data.status === 'APPROVED' ? 'done' : 'waiting'}
        title={intl.formatMessage(business.data === null ? messages.business : messages.businessExists)}
      >
        {business.data === null ? (
          <Text size="sm" c="dimmed">
            <FormattedMessage {...messages.businessBody} />
          </Text>
        ) : (
          <StatusChip value={business.data.status} map={KYC_STATUS} />
        )}
      </Step>
      <Step to="/onboarding/consents" state="optional" title={intl.formatMessage(messages.consents)}>
        <Text size="sm" c="dimmed">
          <FormattedMessage {...messages.consentsBody} />
        </Text>
      </Step>
    </Stack>
  );
}
