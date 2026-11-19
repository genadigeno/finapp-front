// Two-step verification (P18-TSK-012). The customer adds an authenticator app:
//   1. "Set up" asks finapp for a new factor (POST /v1/me/mfa). The setup key is shown ONCE - finapp never
//      returns it again - and lives only in this page's memory, never in storage, a URL or telemetry. If a
//      factor already exists, finapp asks the customer to prove it first (step-up), and replacing it follows.
//   2. The customer types a code from the app; finapp confirms it (POST /v1/me/mfa/confirmation).
// Confirming does not raise this session's assurance: the next sensitive act asks for a fresh code.
//
// finapp offers no read of whether a factor is enrolled (gap G-11), so this page cannot say "on" or "off" -
// it says what happened on this visit, and nothing it does not know.
//
// There is no QR code: a QR library is a new dependency for the owner to approve (D-J). The key is shown
// grouped for typing, and on a phone the link opens the authenticator app directly.
import { Alert, Anchor, Button, Card, List, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained } from '../../design-system/States.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';

const messages = defineMessages({
  title: { id: 'mfa.title', defaultMessage: 'Two-step verification' },
  lead: {
    id: 'mfa.lead',
    defaultMessage:
      'With two-step verification, moving money or changing your security also needs a code from an authenticator app on your phone. A stolen password alone is not enough.',
  },
  replaceNote: {
    id: 'mfa.replaceNote',
    defaultMessage:
      'Already set up? Setting up again replaces your current app; you will be asked for a code from it first.',
  },
  start: { id: 'mfa.start', defaultMessage: 'Set up an authenticator app' },
  step1: { id: 'mfa.step1', defaultMessage: 'Open your authenticator app and add an account.' },
  step2: { id: 'mfa.step2', defaultMessage: 'Enter this setup key, or on this phone use the link below.' },
  step3: { id: 'mfa.step3', defaultMessage: 'Type the code your app now shows.' },
  key: { id: 'mfa.key', defaultMessage: 'Setup key' },
  keyOnce: {
    id: 'mfa.keyOnce',
    defaultMessage: 'This key is shown only now. Do not share it - anyone with it can create your codes.',
  },
  openApp: { id: 'mfa.openApp', defaultMessage: 'Open in authenticator app' },
  code: { id: 'mfa.code', defaultMessage: 'Code from your app' },
  confirm: { id: 'mfa.confirm', defaultMessage: 'Turn on two-step verification' },
  confirmFailed: {
    id: 'mfa.confirmFailed',
    defaultMessage: 'That code did not work. Check the app shows FinApp, wait for a new code, and try again.',
  },
  done: { id: 'mfa.done', defaultMessage: 'Two-step verification is on' },
  doneBody: {
    id: 'mfa.doneBody',
    defaultMessage: 'From now on, we will ask for a code from your app before you move money or change your security.',
  },
});

const codeFormatMessage = defineMessage<{ digits: number }>({
  id: 'mfa.codeFormat',
  defaultMessage: 'Enter the {digits} digits shown in your app.',
});

interface Enrolment {
  provisioningUri: string;
  secret: string;
  digits: number;
}

/** The base32 secret from an otpauth URI, or undefined if the URI is not one. */
export function secretOf(provisioningUri: string): string | undefined {
  try {
    const uri = new URL(provisioningUri);
    if (uri.protocol !== 'otpauth:') return undefined;
    const secret = uri.searchParams.get('secret');
    return secret !== null && /^[A-Z2-7]+=*$/.test(secret) ? secret : undefined;
  } catch {
    return undefined;
  }
}

/** Groups of four, for typing. */
export function groupKey(secret: string): string {
  return secret.replace(/=+$/, '').replace(/(.{4})(?=.)/g, '$1 ');
}

export function MfaPage() {
  const intl = useIntl();
  const api = useApi();
  const [enrolment, setEnrolment] = useState<Enrolment | undefined>();
  const [code, setCode] = useState('');
  const [codeProblem, setCodeProblem] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const start = useCommand(async () => ok(api.POST('/v1/me/mfa')), { routeId: '/security/two-step' });
  const confirm = useCommand(
    async (intent: { body: { code: string } }) => ok(api.POST('/v1/me/mfa/confirmation', { body: intent.body })),
    { routeId: '/security/two-step' },
  );

  const begin = async () => {
    setDone(false);
    setEnrolment(undefined);
    const result = await start.submit({});
    if (result?.status !== 'succeeded') return;
    const { provisioningUri, digits } = result.data;
    const secret = provisioningUri === undefined ? undefined : secretOf(provisioningUri);
    if (provisioningUri === undefined || secret === undefined) return;
    setEnrolment({ provisioningUri, secret, digits: digits ?? 6 });
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (enrolment === undefined) return;
    if (!new RegExp(`^\\d{${enrolment.digits}}$`).test(code)) {
      setCodeProblem(intl.formatMessage(codeFormatMessage, { digits: enrolment.digits }));
      return;
    }
    setCodeProblem(undefined);
    const result = await confirm.submit({ code });
    setCode('');
    if (result?.status === 'succeeded') {
      // The key is forgotten as soon as it has done its job.
      setEnrolment(undefined);
      setDone(true);
    } else if (result?.status === 'refused' && result.error.category === 'validation') {
      setCodeProblem(intl.formatMessage(messages.confirmFailed));
    }
  };

  const startFailure = failureOf(start.state);
  const confirmFailure = failureOf(confirm.state);

  return (
    <Stack gap="lg" maw={560}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text>
        <FormattedMessage {...messages.lead} />
      </Text>
      {done ? (
        <Alert
          color="teal"
          variant="light"
          icon={<IconCircleCheck aria-hidden />}
          title={intl.formatMessage(messages.done)}
        >
          <FormattedMessage {...messages.doneBody} />
        </Alert>
      ) : null}
      {startFailure === undefined ? null : <ErrorExplained error={startFailure.error} />}
      {enrolment === undefined ? (
        <>
          <Text size="sm" c="dimmed">
            <FormattedMessage {...messages.replaceNote} />
          </Text>
          <div>
            <Button onClick={() => void begin()} loading={start.state.status === 'sending'}>
              <FormattedMessage {...messages.start} />
            </Button>
          </div>
        </>
      ) : (
        <Card withBorder radius="md" padding="lg">
          <form onSubmit={(event) => void submitCode(event)} noValidate>
            <Stack>
              <List type="ordered" spacing="xs">
                <List.Item>
                  <FormattedMessage {...messages.step1} />
                </List.Item>
                <List.Item>
                  <FormattedMessage {...messages.step2} />
                </List.Item>
                <List.Item>
                  <FormattedMessage {...messages.step3} />
                </List.Item>
              </List>
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  <FormattedMessage {...messages.key} />
                </Text>
                <Text className="finapp-secret" aria-label={intl.formatMessage(messages.key)}>
                  {groupKey(enrolment.secret)}
                </Text>
                <Text size="sm" c="dimmed">
                  <FormattedMessage {...messages.keyOnce} />
                </Text>
                <Anchor href={enrolment.provisioningUri} rel="noreferrer">
                  <FormattedMessage {...messages.openApp} />
                </Anchor>
              </Stack>
              <TextInput
                label={intl.formatMessage(messages.code)}
                value={code}
                onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, '').slice(0, enrolment.digits))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={enrolment.digits}
                error={codeProblem}
              />
              {confirmFailure !== undefined && codeProblem === undefined ? (
                <ErrorExplained error={confirmFailure.error} />
              ) : null}
              <div>
                <Button type="submit" loading={confirm.state.status === 'sending'}>
                  <FormattedMessage {...messages.confirm} />
                </Button>
              </div>
            </Stack>
          </form>
        </Card>
      )}
    </Stack>
  );
}
