// Value components (blueprint §7; ADR-F04). Each shows exactly what finapp sent: no arithmetic, no
// rounding, no inference. Modelled on the console's Money/StatusBadge/Timestamp (ADR-F08).
import { Badge, Group, Stack, Text, TextInput, type TextInputProps } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconClock, IconInfoCircle } from '@tabler/icons-react';
import { useEffect, type ReactNode } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { serverNow } from '../platform/api/server-clock.ts';
import { formatBusinessDate, formatInstant } from './dates.ts';
import { formatMoney, minorUnits, type MoneyInputProblem } from './money.ts';
import { presentStatus, type StatusMap } from './status.ts';
import { TONE_COLOR, type Tone } from './tone.ts';
import { useNow } from './use-now.ts';

const messages = defineMessages({
  available: { id: 'balance.available', defaultMessage: 'Available' },
  settled: { id: 'balance.settled', defaultMessage: 'Settled balance' },
  holds: { id: 'balance.holds', defaultMessage: 'On hold' },
  reference: { id: 'reference.label', defaultMessage: 'Support reference' },
  countdownExpired: { id: 'countdown.expired', defaultMessage: 'Expired' },
  inputEmpty: { id: 'moneyInput.empty', defaultMessage: 'Enter an amount.' },
  inputZero: { id: 'moneyInput.zero', defaultMessage: 'Enter an amount greater than zero.' },
});

// Messages with placeholders are typed one by one, so a missing or misspelt value fails the build.
const unreadableMessage = defineMessage<{ raw: string }>({
  id: 'value.unreadable',
  defaultMessage: '{raw} (could not be read)',
});
const projectionMessage = defineMessage<{ asOf: string }>({
  id: 'balance.projection',
  defaultMessage: 'Balance as of {asOf}. Payments in progress may change it.',
});
const rateMessage = defineMessage<{ rate: string; source: string; destination: string }>({
  id: 'rate.text',
  defaultMessage: '1 {source} = {rate} {destination}',
});
const countdownMessage = defineMessage<{ time: string }>({
  id: 'countdown.remaining',
  defaultMessage: 'Expires in {time}',
});
const inputFormatMessage = defineMessage<{ example: string }>({
  id: 'moneyInput.format',
  defaultMessage: 'Enter an amount using digits only, like {example}.',
});
const inputScaleMessage = defineMessage<{ currency: string; digits: number }>({
  id: 'moneyInput.scale',
  defaultMessage:
    '{currency} amounts have at most {digits, plural, =0 {no decimals} one {# decimal} other {# decimals}}.',
});

export interface MoneyProps {
  /** The decimal string exactly as finapp sent it. */
  amount: string;
  currency: string;
  /** Larger figure for a headline balance. */
  size?: 'md' | 'lg' | 'xl';
}

/** An amount in the customer's locale; never a float (ADR-F04). */
export function Money({ amount, currency, size = 'md' }: MoneyProps) {
  const intl = useIntl();
  const formatted = formatMoney(amount, currency, intl.locale);
  if (!formatted.valid) {
    return <span className="finapp-invalid">{intl.formatMessage(unreadableMessage, { raw: formatted.raw })}</span>;
  }
  return (
    <span className="finapp-money" data-size={size} data-negative={formatted.negative || undefined}>
      {formatted.text}
    </span>
  );
}

export interface MoneyInputProps extends Omit<TextInputProps, 'value' | 'onChange' | 'error' | 'rightSection'> {
  /** The text as typed - kept as text; the form parses it with parseMoneyInput on submit. */
  value: string;
  onChange: (text: string) => void;
  currency: string;
  /** A problem from parseMoneyInput, shown as the field's error. */
  problem?: MoneyInputProblem | undefined;
}

/** A text field for an amount: string in, string out, the currency always visible (ADR-F04 decision 3). */
export function MoneyInput({ value, onChange, currency, problem, ...rest }: MoneyInputProps) {
  const intl = useIntl();
  const digits = minorUnits(currency);
  const example = formatMoney(digits === 0 ? '125' : `125.${'5'.padEnd(digits, '0')}`, currency, intl.locale);
  const error =
    problem === undefined
      ? undefined
      : problem === 'empty'
        ? intl.formatMessage(messages.inputEmpty)
        : problem === 'format'
          ? intl.formatMessage(inputFormatMessage, { example: example.valid ? example.text : '125' })
          : problem === 'scale'
            ? intl.formatMessage(inputScaleMessage, { currency, digits })
            : intl.formatMessage(messages.inputZero);
  return (
    <TextInput
      {...rest}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      error={error}
      rightSection={<span className="finapp-input-currency">{currency}</span>}
      rightSectionWidth={56}
    />
  );
}

/** An exchange rate exactly as finapp quoted it (ADR-F04 decision 4). */
export function Rate({ rate, source, destination }: { rate: string; source: string; destination: string }) {
  return (
    <span className="finapp-numeric">
      <FormattedMessage {...rateMessage} values={{ rate, source, destination }} />
    </span>
  );
}

export interface BalanceTripletProps {
  currency: string;
  available: string;
  settled: string;
  holds: string;
  /** When the balance was read (the response time). */
  asOf: string;
}

/**
 * A balance as finapp projects it (ADR-0009: a balance says what kind of number it is). Available is the
 * headline; settled and holds are labelled beside it and never summed by the client.
 */
export function BalanceTriplet({ currency, available, settled, holds, asOf }: BalanceTripletProps) {
  const intl = useIntl();
  const at = formatInstant(asOf, intl.locale);
  return (
    <Stack gap={4}>
      <Text size="sm" c="dimmed">
        <FormattedMessage {...messages.available} />
      </Text>
      <Money amount={available} currency={currency} size="xl" />
      <Group gap="lg" mt={4}>
        <Text size="sm">
          <FormattedMessage {...messages.settled} />: <Money amount={settled} currency={currency} />
        </Text>
        <Text size="sm">
          <FormattedMessage {...messages.holds} />: <Money amount={holds} currency={currency} />
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        <FormattedMessage {...projectionMessage} values={{ asOf: at.valid ? at.text : at.raw }} />
      </Text>
    </Stack>
  );
}

const TONE_ICON: Readonly<Record<Tone, typeof IconInfoCircle>> = {
  positive: IconCircleCheck,
  caution: IconAlertTriangle,
  critical: IconCircleX,
  info: IconClock,
  neutral: IconInfoCircle,
};

/** A status in customer words, with an icon and text - colour is never the only signal. */
export function StatusChip({ value, map }: { value: string; map: StatusMap }) {
  const status = presentStatus(value, map);
  const Icon = TONE_ICON[status.tone];
  return (
    <Badge
      color={TONE_COLOR[status.tone]}
      variant="light"
      size="lg"
      radius="xl"
      leftSection={<Icon size={14} aria-hidden />}
      className="finapp-status"
    >
      <FormattedMessage {...status.label} />
    </Badge>
  );
}

/** The correlation reference finapp minted, for the customer to quote to support (DOD-CUST). */
export function CorrelationReference({ correlationId }: { correlationId: string | undefined }) {
  if (correlationId === undefined) return null;
  return (
    <Text size="xs" c="dimmed">
      <FormattedMessage {...messages.reference} />: <span className="finapp-mono">{correlationId}</span>
    </Text>
  );
}

export function BusinessDate({ value }: { value: string }) {
  const intl = useIntl();
  const formatted = formatBusinessDate(value, intl.locale);
  return formatted.valid ? <span>{formatted.text}</span> : <span className="finapp-invalid">{formatted.raw}</span>;
}

export function Timestamp({ value, withZone = false }: { value: string; withZone?: boolean }) {
  const intl = useIntl();
  const formatted = formatInstant(value, intl.locale, { withZone });
  return formatted.valid ? (
    <time dateTime={value}>{formatted.text}</time>
  ) : (
    <span className="finapp-invalid">{formatted.raw}</span>
  );
}

function mmss(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface CountdownProps {
  /** The instant finapp said this expires, judged by finapp's clock (ADR-F05 decision 7). */
  expiresAt: string;
  onExpire?: () => void;
  /** Injectable for tests and the catalogue. */
  now?: () => number;
}

/** Time left on a quote or offer. At zero it says so, and calls onExpire so the confirm control disables. */
export function Countdown({ expiresAt, onExpire, now = () => serverNow() }: CountdownProps): ReactNode {
  useNow(1_000);
  const remaining = Date.parse(expiresAt) - now();
  const expired = Number.isNaN(remaining) || remaining <= 0;
  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);
  return (
    <span className="finapp-countdown" role="timer" aria-live="off" data-expired={expired || undefined}>
      {expired ? (
        <FormattedMessage {...messages.countdownExpired} />
      ) : (
        <FormattedMessage {...countdownMessage} values={{ time: mmss(remaining) }} />
      )}
    </span>
  );
}

const directionMessages = defineMessages({
  in: { id: 'money.direction.in', defaultMessage: 'Money in' },
  out: { id: 'money.direction.out', defaultMessage: 'Money out' },
});

/**
 * A movement: the amount finapp sent (unsigned) and its direction. Money in shows "+", money out "−", and the
 * direction is also said in words - never colour or sign alone (WCAG 1.4.1). The sign is written onto the
 * string; nothing is computed.
 */
export function SignedMoney({
  amount,
  currency,
  direction,
}: {
  amount: string;
  currency: string;
  direction: 'in' | 'out';
}) {
  const intl = useIntl();
  const unsigned = amount.trim().replace(/^[+-]/, '');
  const formatted = formatMoney(direction === 'out' ? `-${unsigned}` : unsigned, currency, intl.locale);
  if (!formatted.valid) {
    return <span className="finapp-invalid">{intl.formatMessage(unreadableMessage, { raw: formatted.raw })}</span>;
  }
  const text = direction === 'in' && !formatted.text.startsWith('+') ? `+${formatted.text}` : formatted.text;
  return (
    <span className="finapp-money" data-direction={direction}>
      <span className="finapp-visually-hidden">{intl.formatMessage(directionMessages[direction])}: </span>
      {text}
    </span>
  );
}
