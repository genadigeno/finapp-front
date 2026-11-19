// The shell's banners: the idle-expiry warning (blueprint §12.4) and the offline notice (§16).
import { Alert, Text } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { SessionExpiring } from '../design-system/States.tsx';
import { useNow } from '../design-system/use-now.ts';
import { standingQueryKey, useSession } from '../platform/session/standing.ts';

const messages = defineMessages({
  offlineTitle: { id: 'banner.offline.title', defaultMessage: 'You are offline' },
  offlineBody: {
    id: 'banner.offline.body',
    defaultMessage: 'Nothing will be sent until your connection is back. Amounts shown may be out of date.',
  },
});

/** Warn this long before the idle bound. */
export const WARNING_BEFORE_MS = 2 * 60_000;

export function SessionExpiryWarning() {
  const session = useSession();
  const client = useQueryClient();
  const now = useNow(1_000);
  if (session.status !== 'signed-in') return null;
  const remaining = session.idleExpiresAt - now;
  if (remaining > WARNING_BEFORE_MS || remaining <= 0) return null;
  // Any authenticated read extends the idle bound on the server; re-reading the profile is the lightest.
  return (
    <SessionExpiring
      remainingMs={remaining}
      onStay={() => void client.refetchQueries({ queryKey: standingQueryKey })}
    />
  );
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** True while the browser reports a connection. Command screens disable their submit when false. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner() {
  const intl = useIntl();
  const online = useOnline();
  if (online) return null;
  return (
    <Alert
      color="gray"
      variant="light"
      icon={<IconWifiOff aria-hidden />}
      title={intl.formatMessage(messages.offlineTitle)}
      role="status"
    >
      <Text>
        <FormattedMessage {...messages.offlineBody} />
      </Text>
    </Alert>
  );
}
