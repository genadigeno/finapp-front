// The currencies a customer can choose from: the ones finapp holds money in (labels.ts), named in the
// customer's language, minus any the account already holds.
import { SUPPORTED_CURRENCIES } from './labels.ts';

export interface CurrencyOption {
  value: string;
  label: string;
}

export function currencyOptions(locale: string, exclude: readonly string[] = []): CurrencyOption[] {
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames([locale], { type: 'currency' });
  } catch {
    names = undefined;
  }
  return SUPPORTED_CURRENCIES.filter((code) => !exclude.includes(code)).map((code) => ({
    value: code,
    label: `${code} - ${names?.of(code) ?? code}`,
  }));
}
