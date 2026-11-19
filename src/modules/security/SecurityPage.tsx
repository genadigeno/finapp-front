// The security centre (blueprint §6; P18-TSK-032): where the customer protects their account and finds their
// details - two-step verification, signed-in devices, password, details and consents. Removing a second factor and
// recovery codes have no door in finapp (G-11), so they are not offered.
import { Card, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconChecklist, IconDevices, IconKey, IconLock, IconUser } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';

const messages = defineMessages({
  title: { id: 'security.title', defaultMessage: 'Security' },
  twoStep: { id: 'security.twoStep', defaultMessage: 'Two-step verification' },
  twoStepBody: {
    id: 'security.twoStep.body',
    defaultMessage: 'Use an authenticator app so that a password alone is never enough to move your money.',
  },
  devices: { id: 'security.devices', defaultMessage: 'Signed-in devices' },
  devicesBody: {
    id: 'security.devices.body',
    defaultMessage: 'See where your account is signed in, and sign out any device.',
  },
  password: { id: 'security.password', defaultMessage: 'Password' },
  passwordBody: { id: 'security.password.body', defaultMessage: 'Change the password you sign in with.' },
  details: { id: 'security.details', defaultMessage: 'Your details' },
  detailsBody: {
    id: 'security.details.body',
    defaultMessage: 'Your name, how you sign in and your customer reference.',
  },
  consents: { id: 'security.consents', defaultMessage: 'Your consents' },
  consentsBody: {
    id: 'security.consents.body',
    defaultMessage: 'What you have agreed we may do with your data.',
  },
});

function Entry({ to, icon, title, children }: { to: string; icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <UnstyledButton component={Link} to={to} className="finapp-entry">
      <Card withBorder radius="md" padding="lg">
        <div className="finapp-entry__row">
          {icon}
          <Stack gap={2} className="finapp-entry__text">
            <Text fw={600}>{title}</Text>
            <Text size="sm" c="dimmed">
              {children}
            </Text>
          </Stack>
          <IconChevronRight aria-hidden />
        </div>
      </Card>
    </UnstyledButton>
  );
}

export function SecurityPage() {
  return (
    <Stack gap="lg">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Entry to="/security/two-step" icon={<IconKey aria-hidden />} title={<FormattedMessage {...messages.twoStep} />}>
        <FormattedMessage {...messages.twoStepBody} />
      </Entry>
      <Entry
        to="/security/devices"
        icon={<IconDevices aria-hidden />}
        title={<FormattedMessage {...messages.devices} />}
      >
        <FormattedMessage {...messages.devicesBody} />
      </Entry>
      <Entry
        to="/security/password"
        icon={<IconLock aria-hidden />}
        title={<FormattedMessage {...messages.password} />}
      >
        <FormattedMessage {...messages.passwordBody} />
      </Entry>
      <Entry to="/profile" icon={<IconUser aria-hidden />} title={<FormattedMessage {...messages.details} />}>
        <FormattedMessage {...messages.detailsBody} />
      </Entry>
      <Entry
        to="/onboarding/consents"
        icon={<IconChecklist aria-hidden />}
        title={<FormattedMessage {...messages.consents} />}
      >
        <FormattedMessage {...messages.consentsBody} />
      </Entry>
    </Stack>
  );
}
