// The money-moving pattern (blueprint §7, ADR-F05): a Wizard of steps held in memory, a ReviewPanel that
// shows every fee and rate before confirmation and submits once, and a ResultPanel that says honestly what
// happened - including "in progress" and "we are checking".
import { Button, Card, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconCircleCheck, IconCircleX, IconClock, IconHelpHexagon } from '@tabler/icons-react';
import { useRef, useState, type ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { CorrelationReference } from './Values.tsx';

const messages = defineMessages({
  back: { id: 'review.back', defaultMessage: 'Back' },
  confirm: { id: 'review.confirm', defaultMessage: 'Confirm' },
});

const stepMessage = defineMessage<{ current: number; total: number }>({
  id: 'wizard.step',
  defaultMessage: 'Step {current} of {total}',
});

export interface WizardProps {
  /** The step names, in order. */
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  children: ReactNode;
}

/**
 * Steps of one journey. Progress is a plain ordered list (no style injection, read in order by screen
 * readers); what the customer enters lives in the parent's memory only and is never stored (ADR-F07).
 */
export function Wizard({ steps, current, children }: WizardProps) {
  const intl = useIntl();
  return (
    <Stack gap="lg">
      <nav aria-label={intl.formatMessage(stepMessage, { current: current + 1, total: steps.length })}>
        <ol className="finapp-wizard">
          {steps.map((name, index) => (
            <li
              key={name}
              className="finapp-wizard__step"
              data-state={index < current ? 'done' : index === current ? 'current' : 'todo'}
              aria-current={index === current ? 'step' : undefined}
            >
              <span className="finapp-wizard__index" aria-hidden>
                {index + 1}
              </span>
              <span>{name}</span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="finapp-panel">{children}</div>
    </Stack>
  );
}

export interface ReviewRow {
  label: string;
  value: ReactNode;
  /** Fees, rates and the amount that will leave the account are emphasised. */
  emphasis?: boolean;
}

export interface ReviewPanelProps {
  title: string;
  rows: readonly ReviewRow[];
  /** Anything the customer must read before confirming (terms, a countdown). */
  notice?: ReactNode;
  confirmLabel?: string;
  /** Disabled when the quote expired or terms must be re-read. */
  confirmDisabled?: boolean;
  /** Sends the command; the panel disables itself on the first press and never sends twice. */
  onConfirm: () => Promise<void> | void;
  onBack?: () => void;
}

/** Review before a command. The confirm control is disabled from the first press (ADR-F05 decision 5). */
export function ReviewPanel({
  title,
  rows,
  notice,
  confirmLabel,
  confirmDisabled = false,
  onConfirm,
  onBack,
}: ReviewPanelProps) {
  const intl = useIntl();
  // The ref guards synchronously (a double click lands before a re-render); the state disables the control.
  const sent = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (sent.current) return;
    sent.current = true;
    setSubmitted(true);
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card withBorder padding="lg" radius="md">
      <Stack>
        <Title order={2}>{title}</Title>
        <dl className="finapp-review">
          {rows.map((row) => (
            <div key={row.label} className="finapp-review__row" data-emphasis={row.emphasis || undefined}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        {notice === undefined ? null : (
          <>
            <Divider />
            {notice}
          </>
        )}
        <Group justify="space-between">
          {onBack === undefined ? (
            <span />
          ) : (
            <Button variant="default" onClick={onBack} disabled={busy}>
              <FormattedMessage {...messages.back} />
            </Button>
          )}
          <Button onClick={() => void confirm()} loading={busy} disabled={confirmDisabled || submitted}>
            {confirmLabel ?? intl.formatMessage(messages.confirm)}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export type ResultKind = 'succeeded' | 'pending' | 'refused' | 'unknown';

const RESULT_ICON = {
  succeeded: { Icon: IconCircleCheck, color: 'var(--mantine-color-teal-text)' },
  pending: { Icon: IconClock, color: 'var(--mantine-color-blue-text)' },
  refused: { Icon: IconCircleX, color: 'var(--mantine-color-red-text)' },
  unknown: { Icon: IconHelpHexagon, color: 'var(--mantine-color-orange-text)' },
} as const;

export interface ResultPanelProps {
  kind: ResultKind;
  title: string;
  children?: ReactNode;
  correlationId?: string | undefined;
  actions?: ReactNode;
}

/** The outcome of a command, with the reference to quote. "Pending" and "unknown" are never success. */
export function ResultPanel({ kind, title, children, correlationId, actions }: ResultPanelProps) {
  const { Icon, color } = RESULT_ICON[kind];
  return (
    <Card withBorder padding="lg" radius="md" role="status" data-result={kind}>
      <Stack align="flex-start">
        <Icon size={40} color={color} aria-hidden />
        <Title order={2}>{title}</Title>
        {children === undefined ? null : <Text>{children}</Text>}
        <CorrelationReference correlationId={correlationId} />
        {actions === undefined ? null : <Group>{actions}</Group>}
      </Stack>
    </Card>
  );
}
