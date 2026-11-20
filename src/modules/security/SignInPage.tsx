// Sign in (P18-TSK-010; blueprint §12.3). One message for every refusal the customer can act on, never
// revealing whether an account exists or is locked (finapp answers all of them the same way). After
// signing in, the customer goes to the validated `returnTo`, or home.
import { Anchor, Button, Card, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { z } from 'zod';
import { ErrorExplained } from '../../design-system/States.tsx';
import { ApiError } from '../../platform/api/api-error.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { zodResolver } from '../../platform/forms/zod-resolver.ts';
import { DEFAULT_SIGNED_IN_PATH, useReturnTo } from '../../platform/return-to.ts';
import { signIn } from '../../platform/session/auth-api.ts';

const messages = defineMessages({
  title: { id: 'signIn.title', defaultMessage: 'Sign in' },
  login: { id: 'signIn.login', defaultMessage: 'Login name' },
  password: { id: 'signIn.password', defaultMessage: 'Password' },
  submit: { id: 'signIn.submit', defaultMessage: 'Sign in' },
  loginRequired: { id: 'signIn.login.required', defaultMessage: 'Enter your login name.' },
  passwordRequired: { id: 'signIn.password.required', defaultMessage: 'Enter your password.' },
  noAccount: { id: 'signIn.noAccount', defaultMessage: 'New to FinApp?' },
  register: { id: 'signIn.register', defaultMessage: 'Open an account' },
  failed: { id: 'signIn.failed', defaultMessage: 'Sign-in failed. Check your login name and password and try again.' },
});

export function SignInPage() {
  const intl = useIntl();
  const api = useApi();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [failure, setFailure] = useState<unknown>(undefined);

  const schema = z.object({
    loginIdentifier: z.string().trim().min(1, intl.formatMessage(messages.loginRequired)),
    password: z.string().min(1, intl.formatMessage(messages.passwordRequired)),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { loginIdentifier: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async ({ loginIdentifier, password }) => {
    setFailure(undefined);
    try {
      await signIn(api, loginIdentifier, password);
      form.reset();
      await navigate({ to: returnTo ?? DEFAULT_SIGNED_IN_PATH, replace: true });
    } catch (error) {
      // The password never outlives a failed attempt.
      form.resetField('password');
      setFailure(error);
    }
  });

  const uniformRefusal =
    failure instanceof ApiError && (failure.isUnauthenticated || failure.code === 'identity.AuthenticationFailed');

  return (
    <Card withBorder radius="lg" padding="xl" className="finapp-auth">
      <Stack gap="lg">
        <Title order={1}>
          <FormattedMessage {...messages.title} />
        </Title>
        {failure === undefined ? null : uniformRefusal ? (
          <Text role="alert" c="red">
            <FormattedMessage {...messages.failed} />
          </Text>
        ) : (
          <ErrorExplained error={failure} />
        )}
        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <Stack>
            <TextInput
              label={intl.formatMessage(messages.login)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              error={form.formState.errors.loginIdentifier?.message}
              {...form.register('loginIdentifier')}
            />
            <PasswordInput
              label={intl.formatMessage(messages.password)}
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <Button type="submit" loading={form.formState.isSubmitting}>
              <FormattedMessage {...messages.submit} />
            </Button>
          </Stack>
        </form>
        <Text>
          <FormattedMessage {...messages.noAccount} />{' '}
          <Anchor component={Link} to="/register">
            <FormattedMessage {...messages.register} />
          </Anchor>
        </Text>
      </Stack>
    </Card>
  );
}
