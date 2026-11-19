// Consents (P18-TSK-013; ADR-0037, INV-IDN-04): what the customer allows FinApp to do with their data,
// purpose by purpose. Each grant names the exact text version the customer read - the text shown is the
// one finapp serves - and signing in is never consent. Withdrawing is as easy as granting.
import { Alert, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { ConfirmDangerous } from '../../design-system/Dialogs.tsx';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { ok } from '../../platform/api/client.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';

export const CONSENTS_QUERY = ['consents'] as const;

/** The purposes finapp's contract names (ConsentGrantRequest.purpose). */
export type ConsentPurpose = 'KYC_PROCESSING' | 'SCREENING' | 'CREDIT_BUREAU_ACCESS' | 'FINANCIAL_DATA_ACCESS';

const PURPOSES: readonly string[] = ['KYC_PROCESSING', 'SCREENING', 'CREDIT_BUREAU_ACCESS', 'FINANCIAL_DATA_ACCESS'];

const purposeNames = defineMessages({
  KYC_PROCESSING: { id: 'consent.purpose.kyc', defaultMessage: 'Checking your identity' },
  SCREENING: { id: 'consent.purpose.screening', defaultMessage: 'Screening against sanctions and fraud lists' },
  CREDIT_BUREAU_ACCESS: { id: 'consent.purpose.bureau', defaultMessage: 'Checking your credit history' },
  FINANCIAL_DATA_ACCESS: { id: 'consent.purpose.financialData', defaultMessage: 'Using your financial data' },
});

const messages = defineMessages({
  title: { id: 'consents.title', defaultMessage: 'Your consents' },
  lead: {
    id: 'consents.lead',
    defaultMessage:
      'You decide what we may do with your data. Read each text before you agree. You can withdraw at any time.',
  },
  granted: { id: 'consents.granted', defaultMessage: 'You agreed' },
  notGranted: { id: 'consents.notGranted', defaultMessage: 'Not agreed' },
  agree: { id: 'consents.agree', defaultMessage: 'I agree' },
  withdraw: { id: 'consents.withdraw', defaultMessage: 'Withdraw' },
  withdrawTitle: { id: 'consents.withdraw.title', defaultMessage: 'Withdraw this consent?' },
  withdrawBody: {
    id: 'consents.withdraw.body',
    defaultMessage:
      'We will stop using your data for this purpose from now on. Some services that depend on it may stop working until you agree again.',
  },
  noText: {
    id: 'consents.noText',
    defaultMessage: 'The text for this consent could not be shown, so it cannot be agreed to here.',
  },
  otherPurpose: { id: 'consents.otherPurpose', defaultMessage: 'Another use of your data' },
});

const versionMessage = defineMessage<{ version: number }>({
  id: 'consents.version',
  defaultMessage: 'Text version {version}',
});

export interface ConsentView {
  purpose: string;
  text: string | undefined;
  version: number | undefined;
  granted: boolean;
}

export function useConsents() {
  const api = useApi();
  return useQuery({
    queryKey: CONSENTS_QUERY,
    queryFn: async (): Promise<ConsentView[]> => {
      const { data } = await ok(api.GET('/v1/me/consents'));
      return data.flatMap((c) =>
        c.purpose === undefined
          ? []
          : [{ purpose: c.purpose, text: c.currentText, version: c.currentTextVersion, granted: c.granted === true }],
      );
    },
  });
}

export function purposeName(purpose: string): MessageDescriptor {
  return PURPOSES.includes(purpose) ? purposeNames[purpose as ConsentPurpose] : messages.otherPurpose;
}

export function ConsentCard({ consent }: { consent: ConsentView }) {
  const intl = useIntl();
  const api = useApi();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const grant = useCommand(
    async (intent: { body: { purpose: ConsentPurpose; textVersion: number } }) =>
      ok(api.POST('/v1/me/consents', { body: intent.body })),
    { invalidate: ['consents', 'kyc'], routeId: '/onboarding/consents' },
  );
  const withdraw = useCommand(
    async (intent: { body: { purpose: string } }) =>
      ok(
        api.DELETE('/v1/me/consents/{purpose}', {
          params: { path: { purpose: intent.body.purpose as ConsentPurpose } },
        }),
      ),
    { invalidate: ['consents', 'kyc'], routeId: '/onboarding/consents' },
  );
  const failed = failureOf(grant.state) ?? failureOf(withdraw.state);
  const known = PURPOSES.includes(consent.purpose);
  const agreeable = known && consent.text !== undefined && consent.version !== undefined;

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2}>{intl.formatMessage(purposeName(consent.purpose))}</Title>
          <Badge variant="light" color={consent.granted ? 'teal' : 'gray'}>
            <FormattedMessage {...(consent.granted ? messages.granted : messages.notGranted)} />
          </Badge>
        </Group>
        {consent.text === undefined ? (
          <Text c="dimmed">
            <FormattedMessage {...messages.noText} />
          </Text>
        ) : (
          <Text className="finapp-consent-text">{consent.text}</Text>
        )}
        {consent.version === undefined ? null : (
          <Text size="xs" c="dimmed">
            <FormattedMessage {...versionMessage} values={{ version: consent.version }} />
          </Text>
        )}
        {failed === undefined ? null : <ErrorExplained error={failed.error} />}
        <Group>
          {consent.granted ? (
            <Button
              variant="default"
              onClick={() => setConfirmWithdraw(true)}
              loading={withdraw.state.status === 'sending'}
            >
              <FormattedMessage {...messages.withdraw} />
            </Button>
          ) : agreeable ? (
            <Button
              loading={grant.state.status === 'sending'}
              onClick={() =>
                void grant.submit({ purpose: consent.purpose as ConsentPurpose, textVersion: consent.version ?? 0 })
              }
            >
              <FormattedMessage {...messages.agree} />
            </Button>
          ) : null}
        </Group>
      </Stack>
      <ConfirmDangerous
        opened={confirmWithdraw}
        title={intl.formatMessage(messages.withdrawTitle)}
        confirmLabel={intl.formatMessage(messages.withdraw)}
        busy={withdraw.state.status === 'sending'}
        onCancel={() => setConfirmWithdraw(false)}
        onConfirm={() => void withdraw.submit({ purpose: consent.purpose }).finally(() => setConfirmWithdraw(false))}
      >
        <Text>
          <FormattedMessage {...messages.withdrawBody} />
        </Text>
      </ConfirmDangerous>
    </Card>
  );
}

export function ConsentsPage() {
  const consents = useConsents();
  if (consents.isPending) return <LoadingState />;
  if (consents.isError) return <ErrorExplained error={consents.error} onRetry={() => void consents.refetch()} />;
  return (
    <Stack gap="lg">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Alert variant="light" color="blue">
        <FormattedMessage {...messages.lead} />
      </Alert>
      {consents.data.map((consent) => (
        <ConsentCard key={consent.purpose} consent={consent} />
      ))}
    </Stack>
  );
}
