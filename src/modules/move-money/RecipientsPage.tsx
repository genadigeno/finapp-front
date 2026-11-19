// Your recipients (P18-TSK-021): the FinApp accounts the customer sends to, each saved with a name the customer
// chose. A recipient is named by their account reference, which they share with the customer - finapp offers no
// search for another customer's account (G-09). Removing a recipient is confirmed.
import { Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { z } from 'zod';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { zodResolver } from '../../platform/forms/zod-resolver.ts';
import { BENEFICIARIES_ROOT, useBeneficiaries, type Beneficiary } from './api.ts';

const messages = defineMessages({
  title: { id: 'recipients.title', defaultMessage: 'Your recipients' },
  empty: { id: 'recipients.empty', defaultMessage: 'No recipients yet' },
  emptyBody: { id: 'recipients.empty.body', defaultMessage: 'Add someone to send them money.' },
  send: { id: 'recipients.send', defaultMessage: 'Send money' },
  remove: { id: 'recipients.remove', defaultMessage: 'Remove' },
  removeTitle: { id: 'recipients.remove.title', defaultMessage: 'Remove this recipient?' },
  removeBody: {
    id: 'recipients.remove.body',
    defaultMessage: 'You will no longer see them here. Money already sent is not affected.',
  },
  addTitle: { id: 'recipients.add.title', defaultMessage: 'Add a recipient' },
  addLead: {
    id: 'recipients.add.lead',
    defaultMessage:
      'Ask the person for their FinApp account reference - they find it on their account page. Check it carefully: money sent to the wrong account may not come back.',
  },
  name: { id: 'recipients.name', defaultMessage: 'Name for this recipient' },
  account: { id: 'recipients.account', defaultMessage: 'Their account reference' },
  add: { id: 'recipients.add', defaultMessage: 'Add recipient' },
  nameRequired: { id: 'recipients.name.required', defaultMessage: 'Enter a name.' },
  accountInvalid: {
    id: 'recipients.account.invalid',
    defaultMessage: 'An account reference looks like 0190a3c1-1111-7222-8333-444455556666.',
  },
  added: { id: 'recipients.added', defaultMessage: 'Added.' },
  reference: { id: 'recipients.reference', defaultMessage: 'Account' },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AddRecipient() {
  const intl = useIntl();
  const api = useApi();
  const [added, setAdded] = useState(false);
  const schema = z.object({
    displayName: z.string().trim().min(1, intl.formatMessage(messages.nameRequired)).max(200),
    destinationAccountId: z.string().trim().regex(UUID, intl.formatMessage(messages.accountInvalid)),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', destinationAccountId: '' },
  });
  // finapp takes no idempotency key here yet (G-12): a lost answer is checked against the list, never re-sent blind.
  const add = useCommand(
    async (intent: { body: { displayName: string; destinationAccountId: string } }) =>
      ok(api.POST('/v1/beneficiaries', { body: { ...intent.body } })),
    { invalidate: [BENEFICIARIES_ROOT], routeId: '/move/recipients' },
  );
  const failure = failureOf(add.state);
  const onSubmit = form.handleSubmit(async ({ displayName, destinationAccountId }) => {
    setAdded(false);
    const result = await add.submit({ displayName, destinationAccountId: destinationAccountId.toLowerCase() });
    if (result?.status === 'succeeded') {
      form.reset();
      setAdded(true);
    }
  });
  return (
    <Card withBorder radius="md" padding="lg">
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Stack>
          <Title order={2}>
            <FormattedMessage {...messages.addTitle} />
          </Title>
          <Text>
            <FormattedMessage {...messages.addLead} />
          </Text>
          <TextInput
            label={intl.formatMessage(messages.name)}
            error={form.formState.errors.displayName?.message}
            {...form.register('displayName')}
          />
          <TextInput
            label={intl.formatMessage(messages.account)}
            autoComplete="off"
            spellCheck={false}
            error={form.formState.errors.destinationAccountId?.message}
            {...form.register('destinationAccountId')}
          />
          {failure === undefined ? null : <ErrorExplained error={failure.error} />}
          {added ? (
            <Text c="teal" role="status">
              <FormattedMessage {...messages.added} />
            </Text>
          ) : null}
          <div>
            <Button type="submit" loading={add.state.status === 'sending'}>
              <FormattedMessage {...messages.add} />
            </Button>
          </div>
        </Stack>
      </form>
    </Card>
  );
}

function RecipientRow({ recipient }: { recipient: Beneficiary }) {
  const intl = useIntl();
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const remove = useCommand(
    async (intent: { body: { id: string } }) =>
      ok(api.DELETE('/v1/beneficiaries/{id}', { params: { path: { id: intent.body.id } } })),
    { invalidate: [BENEFICIARIES_ROOT], routeId: '/move/recipients' },
  );
  const failure = failureOf(remove.state);
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Stack gap={2}>
            <Text fw={600}>{recipient.displayName}</Text>
            {recipient.destinationAccountId === undefined ? null : (
              <Text size="xs" c="dimmed" className="finapp-mono">
                <FormattedMessage {...messages.reference} />: {recipient.destinationAccountId}
              </Text>
            )}
          </Stack>
          <Group gap="xs">
            <Button
              renderRoot={(props) => <Link {...props} to="/move/send" search={{ to: recipient.id }} />}
              variant="light"
            >
              <FormattedMessage {...messages.send} />
            </Button>
            <Button variant="subtle" color="red" onClick={() => setConfirming(true)}>
              <FormattedMessage {...messages.remove} />
            </Button>
          </Group>
        </Group>
        {failure === undefined ? null : <ErrorExplained error={failure.error} />}
      </Stack>
      <ConfirmDangerous
        opened={confirming}
        title={intl.formatMessage(messages.removeTitle)}
        confirmLabel={intl.formatMessage(messages.remove)}
        busy={remove.state.status === 'sending'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove.submit({ id: recipient.id }).finally(() => setConfirming(false))}
      >
        <Text>
          <FormattedMessage {...messages.removeBody} />
        </Text>
      </ConfirmDangerous>
    </Card>
  );
}

export function RecipientsPage() {
  const intl = useIntl();
  const recipients = useBeneficiaries();
  return (
    <Stack gap="lg">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      {recipients.isPending ? (
        <LoadingState />
      ) : recipients.isError ? (
        <ErrorExplained error={recipients.error} onRetry={() => void recipients.refetch()} />
      ) : recipients.data.length === 0 ? (
        <EmptyState title={intl.formatMessage(messages.empty)}>
          <FormattedMessage {...messages.emptyBody} />
        </EmptyState>
      ) : (
        recipients.data.map((recipient) => <RecipientRow key={recipient.id} recipient={recipient} />)
      )}
      <AddRecipient />
    </Stack>
  );
}
