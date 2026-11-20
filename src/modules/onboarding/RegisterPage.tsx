// Open an account (P18-TSK-011). finapp creates the person, the customer and the sign-in in one step
// (POST /v1/registrations, under an idempotency key) and does NOT sign them in: this page then signs in
// with the same credentials, held in memory only for those two calls, and goes to the onboarding checklist.
//
// Every refusal of the registration itself is one uniform answer (`party.RegistrationRefused`): finapp
// never says whether a login name is taken, and neither does this page.
import { Anchor, Button, Card, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { z } from 'zod';
import { ErrorExplained, UnknownOutcome } from '../../design-system/States.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import type { IdempotencyIntent } from '../../platform/api/idempotency.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { zodResolver } from '../../platform/forms/zod-resolver.ts';
import { signIn } from '../../platform/session/auth-api.ts';

const messages = defineMessages({
  title: { id: 'register.title', defaultMessage: 'Open an account' },
  lead: {
    id: 'register.lead',
    defaultMessage: 'It takes a minute. You will verify your identity next, before you can hold or move money.',
  },
  displayName: { id: 'register.displayName', defaultMessage: 'Your name' },
  displayNameHint: { id: 'register.displayName.hint', defaultMessage: 'How we address you. You can change it later.' },
  login: { id: 'register.login', defaultMessage: 'Login name' },
  loginHint: {
    id: 'register.login.hint',
    defaultMessage: '3 to 64 letters, digits, dots, dashes or underscores. You sign in with it.',
  },
  password: { id: 'register.password', defaultMessage: 'Password' },
  passwordHint: {
    id: 'register.password.hint',
    defaultMessage: 'At least 8 characters. A longer passphrase is stronger than a short complex one.',
  },
  confirm: { id: 'register.confirm', defaultMessage: 'Repeat the password' },
  submit: { id: 'register.submit', defaultMessage: 'Open my account' },
  haveAccount: { id: 'register.haveAccount', defaultMessage: 'Already have an account?' },
  signIn: { id: 'register.signIn', defaultMessage: 'Sign in' },
  nameRequired: { id: 'register.name.required', defaultMessage: 'Enter your name.' },
  nameTooLong: { id: 'register.name.tooLong', defaultMessage: 'Use at most 200 characters.' },
  nameInvalid: { id: 'register.name.invalid', defaultMessage: 'Use letters, digits, spaces and punctuation only.' },
  loginInvalid: {
    id: 'register.login.invalid',
    defaultMessage: 'Use 3 to 64 letters, digits, dots, dashes or underscores.',
  },
  passwordLength: { id: 'register.password.length', defaultMessage: 'Use between 8 and 256 characters.' },
  confirmMismatch: { id: 'register.confirm.mismatch', defaultMessage: 'The two passwords are not the same.' },
  signInAfter: {
    id: 'register.signInAfter',
    defaultMessage: 'Your account is open, but we could not sign you in. Sign in with your new login name.',
  },
});

/** finapp's RegistrationRequest: a display name without control, format or private-use characters. */
const DISPLAY_NAME = /^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]+$/u;
const LOGIN = /^[A-Za-z0-9._-]{3,64}$/;

interface Registration {
  displayName: string;
  loginIdentifier: string;
  password: string;
}

export function RegisterPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const [signInFailed, setSignInFailed] = useState(false);

  const schema = z
    .object({
      displayName: z
        .string()
        .trim()
        .min(1, intl.formatMessage(messages.nameRequired))
        .max(200, intl.formatMessage(messages.nameTooLong))
        .regex(DISPLAY_NAME, intl.formatMessage(messages.nameInvalid)),
      loginIdentifier: z.string().trim().regex(LOGIN, intl.formatMessage(messages.loginInvalid)),
      password: z
        .string()
        .min(8, intl.formatMessage(messages.passwordLength))
        .max(256, intl.formatMessage(messages.passwordLength)),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      path: ['confirm'],
      message: intl.formatMessage(messages.confirmMismatch),
    });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', loginIdentifier: '', password: '', confirm: '' },
  });

  const register = useCommand(
    async (intent: IdempotencyIntent<Registration>) =>
      ok(api.POST('/v1/registrations', { body: { ...intent.body }, params: { header: intent.headers() } })),
    { routeId: '/register' },
  );

  const complete = async (registration: Registration) => {
    try {
      await signIn(api, registration.loginIdentifier, registration.password);
      form.reset();
      await navigate({ to: '/home', replace: true });
    } catch {
      form.reset();
      setSignInFailed(true);
    }
  };

  const onSubmit = form.handleSubmit(async ({ displayName, loginIdentifier, password }) => {
    setSignInFailed(false);
    const registration = { displayName, loginIdentifier, password };
    const result = await register.submit(registration);
    if (result?.status === 'succeeded') await complete(registration);
  });

  const failure = failureOf(register.state);

  if (signInFailed) {
    return (
      <Card withBorder radius="lg" padding="xl" className="finapp-auth">
        <Stack gap="md">
          <Title order={1}>
            <FormattedMessage {...messages.title} />
          </Title>
          <Text>
            <FormattedMessage {...messages.signInAfter} />
          </Text>
          <Button component={Link} to="/sign-in">
            <FormattedMessage {...messages.signIn} />
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder radius="lg" padding="xl" className="finapp-auth">
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        <Text>
          <FormattedMessage {...messages.lead} />
        </Text>
        {failure?.status === 'unknown' ? (
          // Sending the same request again is safe: finapp replays the first outcome for the same key.
          <UnknownOutcome correlationId={failure.error.correlationId} onSendSame={() => void onSubmit()} />
        ) : failure !== undefined ? (
          <ErrorExplained error={failure.error} />
        ) : null}
        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <Stack>
            <TextInput
              label={intl.formatMessage(messages.displayName)}
              description={intl.formatMessage(messages.displayNameHint)}
              autoComplete="name"
              error={form.formState.errors.displayName?.message}
              {...form.register('displayName')}
            />
            <TextInput
              label={intl.formatMessage(messages.login)}
              description={intl.formatMessage(messages.loginHint)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              error={form.formState.errors.loginIdentifier?.message}
              {...form.register('loginIdentifier')}
            />
            <PasswordInput
              label={intl.formatMessage(messages.password)}
              description={intl.formatMessage(messages.passwordHint)}
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <PasswordInput
              label={intl.formatMessage(messages.confirm)}
              autoComplete="new-password"
              error={form.formState.errors.confirm?.message}
              {...form.register('confirm')}
            />
            <Button type="submit" loading={register.state.status === 'sending' || form.formState.isSubmitting}>
              <FormattedMessage {...messages.submit} />
            </Button>
          </Stack>
        </form>
        <Text>
          <FormattedMessage {...messages.haveAccount} />{' '}
          <Anchor component={Link} to="/sign-in">
            <FormattedMessage {...messages.signIn} />
          </Anchor>
        </Text>
      </Stack>
    </Card>
  );
}
