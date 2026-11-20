// Every view's explicit states (blueprint §7): loading, empty, an explained error, a feature that is
// unavailable, an unknown outcome, and a session about to expire. Modelled on the console's States.tsx
// (ADR-F08), in customer language: what happened and what to do - never an internal code, only the
// reference to quote.
import { Alert, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import {
  IconAlertTriangle,
  IconClockHour4,
  IconHelpHexagon,
  IconMoodEmpty,
  IconPlugConnectedX,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ApiError } from '../platform/api/api-error.ts';
import { explain } from '../platform/api/problem-catalogue.ts';
import { CorrelationReference } from './Values.tsx';

const messages = defineMessages({
  loading: { id: 'state.loading', defaultMessage: 'Loading' },
  tryAgain: { id: 'state.tryAgain', defaultMessage: 'Try again' },
  unavailableTitle: { id: 'state.unavailable.title', defaultMessage: 'This part of FinApp is not available right now' },
  unavailableBody: {
    id: 'state.unavailable.body',
    defaultMessage: 'Everything else keeps working. Nothing was changed. Please try again later.',
  },
  unknownTitle: { id: 'state.unknown.title', defaultMessage: 'We are checking whether this went through' },
  unknownBody: {
    id: 'state.unknown.body',
    defaultMessage:
      'We did not get a final answer. Your request may already have gone through, so please do not start it again. Check its status - if it did not go through, we will send exactly the same request, which cannot be applied twice.',
  },
  checkStatus: { id: 'state.unknown.check', defaultMessage: 'Check status' },
  sendSame: { id: 'state.unknown.sendSame', defaultMessage: 'Send the same request again' },
  expiringTitle: { id: 'state.expiring.title', defaultMessage: 'You will be signed out soon' },
  staySignedIn: { id: 'state.expiring.stay', defaultMessage: 'Stay signed in' },
});

const expiringBodyMessage = defineMessage<{ time: string }>({
  id: 'state.expiring.body',
  defaultMessage: 'For your security we sign you out after a period of inactivity. Time left: {time}.',
});

export function LoadingState({ rows = 3, label }: { rows?: number; label?: string }) {
  const intl = useIntl();
  return (
    <Stack gap="sm" role="status" aria-live="polite" aria-busy="true">
      <span className="finapp-visually-hidden">{label ?? intl.formatMessage(messages.loading)}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={24} radius="md" />
      ))}
    </Stack>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack align="center" gap={6} py="xl" className="finapp-empty">
      <IconMoodEmpty size={28} aria-hidden />
      <Title order={3}>{title}</Title>
      {children === undefined ? null : <Text c="dimmed">{children}</Text>}
    </Stack>
  );
}

/** A failure explained: what happened, what to do next, and the reference - from the problem catalogue. */
export function ErrorExplained({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const intl = useIntl();
  const explanation = explain(error);
  const correlationId = error instanceof ApiError ? error.correlationId : undefined;
  return (
    <Alert
      color="red"
      variant="light"
      icon={<IconAlertTriangle aria-hidden />}
      title={intl.formatMessage(explanation.title)}
      role="alert"
    >
      <Stack gap={6}>
        <Text>{intl.formatMessage(explanation.nextStep)}</Text>
        <CorrelationReference correlationId={correlationId} />
        {onRetry === undefined ? null : (
          <Group>
            <Button variant="light" color="red" onClick={onRetry}>
              <FormattedMessage {...messages.tryAgain} />
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
}

/** One module is unavailable (503 for its routes): the rest of the application works (blueprint §16). */
export function FeatureUnavailable({ correlationId }: { correlationId?: string | undefined }) {
  const intl = useIntl();
  return (
    <Alert
      color="gray"
      variant="light"
      icon={<IconPlugConnectedX aria-hidden />}
      title={intl.formatMessage(messages.unavailableTitle)}
    >
      <Text>
        <FormattedMessage {...messages.unavailableBody} />
      </Text>
      <CorrelationReference correlationId={correlationId} />
    </Alert>
  );
}

/**
 * A command whose outcome is unknown (ADR-F05 decision 3): it may have been applied. Never shown as a
 * failure. The ways forward: check the status, or send the SAME request with the SAME key.
 */
export function UnknownOutcome({
  correlationId,
  onCheck,
  onSendSame,
}: {
  correlationId?: string | undefined;
  onCheck?: () => void;
  onSendSame?: () => void;
}) {
  const intl = useIntl();
  return (
    <Alert
      color="orange"
      variant="light"
      icon={<IconHelpHexagon aria-hidden />}
      title={intl.formatMessage(messages.unknownTitle)}
      role="status"
    >
      <Stack gap="sm">
        <Text>
          <FormattedMessage {...messages.unknownBody} />
        </Text>
        <CorrelationReference correlationId={correlationId} />
        <Group>
          {onCheck === undefined ? null : (
            <Button onClick={onCheck}>
              <FormattedMessage {...messages.checkStatus} />
            </Button>
          )}
          {onSendSame === undefined ? null : (
            <Button variant="default" onClick={onSendSame}>
              <FormattedMessage {...messages.sendSame} />
            </Button>
          )}
        </Group>
      </Stack>
    </Alert>
  );
}

/** Shown when the idle bound is near (blueprint §12.4). Any activity extends it on the server. */
export function SessionExpiring({ remainingMs, onStay }: { remainingMs: number; onStay: () => void }) {
  const intl = useIntl();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <Alert
      color="navy"
      variant="light"
      icon={<IconClockHour4 aria-hidden />}
      title={intl.formatMessage(messages.expiringTitle)}
      role="status"
    >
      <Stack gap="sm">
        <Text>
          <FormattedMessage {...expiringBodyMessage} values={{ time }} />
        </Text>
        <Group>
          <Button onClick={onStay}>
            <FormattedMessage {...messages.staySignedIn} />
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}
