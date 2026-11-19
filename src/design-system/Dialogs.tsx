// The step-up dialog (ADR-F02, ADR-F05 decision 2) and the confirmation for destructive actions
// (blueprint §7: close a wallet, revoke a beneficiary, withdraw an application).
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState, type FormEvent, type ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { explain } from '../platform/api/problem-catalogue.ts';
import { CustomerModal } from './CustomerModal.tsx';

const messages = defineMessages({
  stepUpTitle: { id: 'stepUp.title', defaultMessage: 'Confirm it is you' },
  stepUpBody: {
    id: 'stepUp.body',
    defaultMessage: 'For your security, enter the 6-digit code from your authenticator app to continue.',
  },
  codeLabel: { id: 'stepUp.code', defaultMessage: 'Authentication code' },
  codeFormat: { id: 'stepUp.codeFormat', defaultMessage: 'Enter the 6 digits shown in your app.' },
  confirm: { id: 'stepUp.confirm', defaultMessage: 'Confirm' },
  cancel: { id: 'dialog.cancel', defaultMessage: 'Cancel' },
});

const CODE = /^\d{6}$/;

export interface StepUpDialogProps {
  opened: boolean;
  /** Proves the code with finapp; rejects with the ApiError when it is refused. */
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
}

/** Asks for the second factor. The code is held only while the dialog is open, and never logged. */
export function StepUpDialog({ opened, onSubmit, onCancel }: StepUpDialogProps) {
  const intl = useIntl();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCode('');
    setProblem(undefined);
    onCancel();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!CODE.test(code)) {
      setProblem(intl.formatMessage(messages.codeFormat));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(code);
      setCode('');
      setProblem(undefined);
    } catch (error) {
      setCode('');
      setProblem(intl.formatMessage(explain(error).nextStep));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerModal opened={opened} onClose={close} title={intl.formatMessage(messages.stepUpTitle)} centered>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          <Text>
            <FormattedMessage {...messages.stepUpBody} />
          </Text>
          <TextInput
            label={intl.formatMessage(messages.codeLabel)}
            value={code}
            onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={problem}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={busy}>
              <FormattedMessage {...messages.cancel} />
            </Button>
            <Button type="submit" loading={busy}>
              <FormattedMessage {...messages.confirm} />
            </Button>
          </Group>
        </Stack>
      </form>
    </CustomerModal>
  );
}

export interface ConfirmDangerousProps {
  opened: boolean;
  title: string;
  /** What will happen, in plain words, including whether it can be undone. */
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/** A destructive action, confirmed explicitly. The safe choice is the default focus. */
export function ConfirmDangerous({
  opened,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDangerousProps) {
  return (
    <CustomerModal opened={opened} onClose={onCancel} title={title} centered>
      <Stack>
        <div>{children}</div>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={busy} data-autofocus>
            <FormattedMessage {...messages.cancel} />
          </Button>
          <Button color="red" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </CustomerModal>
  );
}
