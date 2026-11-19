// Choosing where money comes from (or goes to): one currency of one wallet, shown with its available balance as
// finapp projects it. The balance informs; finapp decides whether there is enough.
import { Select } from '@mantine/core';
import { useIntl } from 'react-intl';
import { formatMoney } from './money.ts';

export interface PocketOption {
  accountId: string;
  currency: string;
  available: string;
}

export const pocketKey = (pocket: { accountId: string; currency: string }) => `${pocket.accountId}:${pocket.currency}`;

export interface PocketSelectProps {
  label: string;
  description?: string;
  pockets: readonly PocketOption[];
  value: string | null;
  onChange: (key: string | null) => void;
  error?: string | undefined;
  /** Offer only these currencies (e.g. the ones a corridor sends). */
  currencies?: readonly string[];
}

export function PocketSelect({ label, description, pockets, value, onChange, error, currencies }: PocketSelectProps) {
  const intl = useIntl();
  const offered = currencies === undefined ? pockets : pockets.filter((p) => currencies.includes(p.currency));
  const data = offered.map((pocket) => {
    const money = formatMoney(pocket.available, pocket.currency, intl.locale);
    const amount = money.valid ? money.text : pocket.available;
    return {
      value: pocketKey(pocket),
      label: intl.formatMessage(
        { id: 'pocket.option', defaultMessage: '{currency} - {amount} available' },
        { currency: pocket.currency, amount },
      ),
    };
  });
  return (
    <Select
      label={label}
      {...(description === undefined ? {} : { description })}
      data={data}
      value={value}
      onChange={onChange}
      error={error}
      allowDeselect={false}
      comboboxProps={{ withinPortal: false }}
    />
  );
}
