// Messages and locale formatting (ADR-F03: FormatJS; blueprint §7).
//
// Every customer-facing sentence is a react-intl descriptor with an English default message, so the
// wording lives beside its use and a translation catalogue keys on the ids. ICU messages are parsed at
// runtime by intl-messageformat - no eval, so the CSP holds. English is the only locale in R1.
import type { ReactNode } from 'react';
import { IntlProvider as FormatJsProvider } from 'react-intl';

export const DEFAULT_LOCALE = 'en';

/** The locale money and dates are formatted in: the browser's, when Intl supports it; English otherwise. */
export function formattingLocale(): string {
  const preferred = typeof navigator === 'undefined' ? undefined : navigator.language;
  try {
    return preferred !== undefined && Intl.NumberFormat.supportedLocalesOf([preferred]).length > 0
      ? preferred
      : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export interface AppIntlProviderProps {
  children: ReactNode;
  /** Overrides the formatting locale (tests and the catalogue pin it). */
  locale?: string;
}

/**
 * Messages are English (the only catalogue in R1); numbers and dates follow the customer's locale. A
 * missing translation in the default locale is not an error: the default message IS the English text.
 */
export function AppIntlProvider({ children, locale }: AppIntlProviderProps) {
  return (
    <FormatJsProvider
      locale={locale ?? formattingLocale()}
      defaultLocale={DEFAULT_LOCALE}
      messages={{}}
      onError={(error) => {
        if (error.code !== 'MISSING_TRANSLATION') throw error;
      }}
    >
      {children}
    </FormatJsProvider>
  );
}
