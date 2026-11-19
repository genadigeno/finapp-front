// Credit (P18-TSK-028; blueprint §6): the customer's loans and credit lines, their pay-later plans, the answers to
// their credit checks, and the ways to borrow. finapp lists no applications or checks still in progress (G-21): a
// customer follows one from its own page.
import { Button, Card, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { EmptyState, ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { BNPL_AGREEMENT_STATUS, CREDIT_OUTCOME, LOAN_STATUS } from '../../design-system/status.ts';
import { StatusChip } from '../../design-system/Values.tsx';
import { useBnplAgreements, useCreditProfile, useLoans } from './api.ts';
import { MaybeMoney, useValueText } from './CreditParts.tsx';
import { planName, productName } from './labels.ts';

const messages = defineMessages({
  title: { id: 'credit.title', defaultMessage: 'Credit' },
  check: { id: 'credit.hub.check', defaultMessage: 'Check what you could borrow' },
  apply: { id: 'credit.hub.apply', defaultMessage: 'Apply for a loan or credit line' },
  checkout: { id: 'credit.hub.checkout', defaultMessage: 'Pay a shop with a checkout code' },
  loans: { id: 'credit.hub.loans', defaultMessage: 'Your loans and credit lines' },
  noLoans: { id: 'credit.hub.noLoans', defaultMessage: 'You have no loans or credit lines' },
  bnpl: { id: 'credit.hub.bnpl', defaultMessage: 'Pay later' },
  noBnpl: { id: 'credit.hub.noBnpl', defaultMessage: 'You have no pay-later plans' },
  bnplHint: {
    id: 'credit.hub.bnplHint',
    defaultMessage: 'You can choose to pay later at a shop’s checkout, when the shop offers it.',
  },
  checks: { id: 'credit.hub.checks', defaultMessage: 'Your credit checks' },
  noChecks: { id: 'credit.hub.noChecks', defaultMessage: 'No current answers' },
  inProgress: {
    id: 'credit.hub.inProgress',
    defaultMessage:
      'A check or application still in progress is not listed here. Follow it from its own page - you can bookmark it.',
  },
  owed: { id: 'credit.hub.owed', defaultMessage: 'You owe' },
  unnamed: { id: 'credit.hub.unnamed', defaultMessage: 'Credit' },
});

const validUntilMessage = defineMessage<{ date: string }>({
  id: 'credit.hub.validUntil',
  defaultMessage: 'Valid until {date}',
});
const sourceMessage = defineMessage<{ date: string }>({
  id: 'credit.hub.source',
  defaultMessage: 'We last looked at your credit history on {date}.',
});
const purchaseMessage = defineMessage<{ date: string }>({
  id: 'credit.hub.purchase',
  defaultMessage: 'Bought on {date}',
});

function Entry({ to, params, children }: { to: string; params: Record<string, string>; children: ReactNode }) {
  return (
    <UnstyledButton renderRoot={(props) => <Link {...props} to={to} params={params} />} className="finapp-entry">
      <Card withBorder radius="md" padding="md">
        <div className="finapp-entry__row">
          <Stack gap={4} className="finapp-entry__text">
            {children}
          </Stack>
          <IconChevronRight aria-hidden />
        </div>
      </Card>
    </UnstyledButton>
  );
}

export function CreditPage() {
  const intl = useIntl();
  const loans = useLoans();
  const agreements = useBnplAgreements();
  const profile = useCreditProfile();
  const text = useValueText();
  const name = (code: string | undefined) => {
    const descriptor = productName(code);
    return descriptor === undefined ? (code ?? intl.formatMessage(messages.unnamed)) : intl.formatMessage(descriptor);
  };
  const bureau = profile.data?.sources?.find((source) => source.sourceKind === 'BUREAU')?.retrievedAt;

  return (
    <Stack gap="xl">
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Group>
        <Button renderRoot={(props) => <Link {...props} to="/credit/check" />}>
          <FormattedMessage {...messages.check} />
        </Button>
        <Button variant="default" renderRoot={(props) => <Link {...props} to="/credit/apply" />}>
          <FormattedMessage {...messages.apply} />
        </Button>
        <Button variant="default" renderRoot={(props) => <Link {...props} to="/checkout" />}>
          <FormattedMessage {...messages.checkout} />
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        <FormattedMessage {...messages.inProgress} />
      </Text>

      <Stack gap="sm">
        <Title order={2}>
          <FormattedMessage {...messages.loans} />
        </Title>
        {loans.isPending ? (
          <LoadingState rows={2} />
        ) : loans.isError ? (
          <ErrorExplained error={loans.error} onRetry={() => void loans.refetch()} />
        ) : loans.data.length === 0 ? (
          <EmptyState title={intl.formatMessage(messages.noLoans)} />
        ) : (
          loans.data.map((loan) =>
            loan.loanId === undefined ? null : (
              <Entry key={loan.loanId} to="/credit/loans/$loanId" params={{ loanId: loan.loanId }}>
                <Group gap="sm">
                  <Text fw={600}>{name(loan.product)}</Text>
                  <StatusChip value={loan.status ?? ''} map={LOAN_STATUS} />
                </Group>
                {loan.balances?.principalOutstanding === undefined ? null : (
                  <Text size="sm">
                    <FormattedMessage {...messages.owed} />{' '}
                    <MaybeMoney amount={loan.balances.principalOutstanding} currency={loan.currency} />
                  </Text>
                )}
              </Entry>
            ),
          )
        )}
      </Stack>

      <Stack gap="sm">
        <Title order={2}>
          <FormattedMessage {...messages.bnpl} />
        </Title>
        {agreements.isPending ? (
          <LoadingState rows={2} />
        ) : agreements.isError ? (
          <ErrorExplained error={agreements.error} onRetry={() => void agreements.refetch()} />
        ) : agreements.data.length === 0 ? (
          <EmptyState title={intl.formatMessage(messages.noBnpl)}>
            <Text size="sm">
              <FormattedMessage {...messages.bnplHint} />
            </Text>
          </EmptyState>
        ) : (
          agreements.data.map((agreement) => {
            if (agreement.agreementId === undefined) return null;
            const plan = planName(agreement.plan);
            return (
              <Entry
                key={agreement.agreementId}
                to="/credit/pay-later/$agreementId"
                params={{ agreementId: agreement.agreementId }}
              >
                <Group gap="sm">
                  <Text fw={600}>
                    {plan === undefined ? name(agreement.product) : intl.formatMessage(plan)}{' '}
                    <MaybeMoney amount={agreement.amount} currency={agreement.currency} />
                  </Text>
                  <StatusChip value={agreement.status ?? ''} map={BNPL_AGREEMENT_STATUS} />
                </Group>
                {agreement.purchaseDate === undefined ? null : (
                  <Text size="sm" c="dimmed">
                    {intl.formatMessage(purchaseMessage, { date: text.date(agreement.purchaseDate) })}
                  </Text>
                )}
                {agreement.owed?.principalOutstanding === undefined ? null : (
                  <Text size="sm">
                    <FormattedMessage {...messages.owed} />{' '}
                    <MaybeMoney amount={agreement.owed.principalOutstanding} currency={agreement.currency} />
                  </Text>
                )}
              </Entry>
            );
          })
        )}
      </Stack>

      <Stack gap="sm">
        <Title order={2}>
          <FormattedMessage {...messages.checks} />
        </Title>
        {profile.isPending ? (
          <LoadingState rows={1} />
        ) : profile.isError ? (
          <ErrorExplained error={profile.error} onRetry={() => void profile.refetch()} />
        ) : (profile.data.decisions ?? []).length === 0 ? (
          <EmptyState title={intl.formatMessage(messages.noChecks)} />
        ) : (
          (profile.data.decisions ?? []).map((decision) =>
            decision.requestId === undefined ? null : (
              <Entry key={decision.requestId} to="/credit/checks/$requestId" params={{ requestId: decision.requestId }}>
                <Group gap="sm">
                  <Text fw={600}>{name(decision.product)}</Text>
                  <StatusChip value={decision.outcome ?? ''} map={CREDIT_OUTCOME} />
                </Group>
                {decision.validUntil === undefined ? null : (
                  <Text size="sm" c="dimmed">
                    {intl.formatMessage(validUntilMessage, { date: text.instant(decision.validUntil) })}
                  </Text>
                )}
              </Entry>
            ),
          )
        )}
        {bureau === undefined ? null : (
          <Text size="sm" c="dimmed">
            {intl.formatMessage(sourceMessage, { date: text.instant(bureau) })}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
