// A restricted account (finapp ADR-0153): it cannot send money, and money it receives still arrives. finapp gives
// no reason and none is shown (INV-RSK-08). The notice only informs: every way to move money stays offered,
// because finapp decides each command under its own lock and says when it refuses.
import { Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { defineMessages, FormattedMessage } from 'react-intl';

const messages = defineMessages({
  suspended: {
    id: 'account.suspended.notice',
    defaultMessage:
      'This account cannot send money at the moment. Money you receive still arrives. Contact us to find out more.',
  },
});

export function SuspendedNotice() {
  return (
    <Alert variant="light" color="yellow" icon={<IconInfoCircle aria-hidden />} role="status">
      <FormattedMessage {...messages.suspended} />
    </Alert>
  );
}
