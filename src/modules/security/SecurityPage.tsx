// The security centre (blueprint §6): where the customer protects their account. Stage 2 offers what finapp
// serves today - two-step verification and signed-in devices. Password change, factor removal and recovery
// codes are Stage 6 (P18-TSK-033; G-11).
import { Card, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconDevices, IconKey } from '@tabler/icons-react';
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
    </Stack>
  );
}
