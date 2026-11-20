// One exchange's receipt (D-R WP-2): what left and what arrived, the rate it was executed at - each exactly as finapp
// returns it - and when it was booked. Read on every view: an operator can reverse a booked exchange later, and only
// this read shows it. `bookedOn` is a business date, formatted without any time zone so it cannot move a day.
// A missing, malformed or not-yours id reads as one neutral "not found".
import { Alert, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Link, useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { TONE_COLOR } from '../../design-system/tone.ts';
import { BusinessDate, Money, Rate, StatusChip, Timestamp } from '../../design-system/Values.tsx';
import { isNotFound, useConversion } from './api.ts';
import { FX_TRADE_STATUS } from './labels.ts';

const messages = defineMessages({
  title: { id: 'fxReceipt.title', defaultMessage: 'Exchange receipt' },
  exchanged: { id: 'fxReceipt.exchanged', defaultMessage: 'You exchanged' },
  received: { id: 'fxReceipt.received', defaultMessage: 'You received' },
  rate: { id: 'fxReceipt.rate', defaultMessage: 'Rate' },
  bookedAt: { id: 'fxReceipt.bookedAt', defaultMessage: 'Booked at' },
  bookedOn: { id: 'fxReceipt.bookedOn', defaultMessage: 'Booking date' },
  reversed: { id: 'fxReceipt.reversed', defaultMessage: 'This exchange was reversed. Check your statement.' },
  notFound: { id: 'fxReceipt.notFound', defaultMessage: 'We could not find this exchange.' },
  back: { id: 'fxReceipt.back', defaultMessage: 'Back to Exchange currencies' },
});

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="wrap" gap="xs">
      <Text c="dimmed">{label}</Text>
      <Text component="div">{children}</Text>
    </Group>
  );
}

export function ConversionReceiptPage() {
  const intl = useIntl();
  const { tradeId } = useParams({ strict: false }) as { tradeId: string };
  const trade = useConversion(tradeId);

  const back = (
    <Link to="/exchange">
      <FormattedMessage {...messages.back} />
    </Link>
  );
  if (trade.isPending) return <LoadingState />;
  if (trade.isError) {
    if (isNotFound(trade.error)) {
      return (
        <Stack gap="sm">
          <Text>
            <FormattedMessage {...messages.notFound} />
          </Text>
          {back}
        </Stack>
      );
    }
    return <ErrorExplained error={trade.error} onRetry={() => void trade.refetch()} />;
  }
  const view = trade.data;
  const status = view.status ?? 'UNKNOWN';

  return (
    <Stack gap="lg" maw={560}>
      {back}
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      {status === 'REVERSED' ? (
        <Alert color={TONE_COLOR.caution} variant="light" icon={<IconAlertTriangle aria-hidden />} role="status">
          <FormattedMessage {...messages.reversed} />
        </Alert>
      ) : null}
      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <div>
            <StatusChip value={status} map={FX_TRADE_STATUS} />
          </div>
          {view.sourceAmount === undefined || view.sourceCurrency === undefined ? null : (
            <Row label={intl.formatMessage(messages.exchanged)}>
              <Money amount={view.sourceAmount} currency={view.sourceCurrency} />
            </Row>
          )}
          {view.destinationAmount === undefined || view.destinationCurrency === undefined ? null : (
            <Row label={intl.formatMessage(messages.received)}>
              <Money amount={view.destinationAmount} currency={view.destinationCurrency} />
            </Row>
          )}
          {view.executedRate === undefined ? null : (
            <Row label={intl.formatMessage(messages.rate)}>
              <Rate
                rate={view.executedRate}
                source={view.sourceCurrency ?? ''}
                destination={view.destinationCurrency ?? ''}
              />
            </Row>
          )}
          {view.bookedAt === undefined ? null : (
            <Row label={intl.formatMessage(messages.bookedAt)}>
              <Timestamp value={view.bookedAt} withZone />
            </Row>
          )}
          {view.bookedOn === undefined ? null : (
            <Row label={intl.formatMessage(messages.bookedOn)}>
              <BusinessDate value={view.bookedOn} />
            </Row>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
