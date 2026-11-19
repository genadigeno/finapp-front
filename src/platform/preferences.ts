// The ONE thing this application keeps in browser storage (ADR-F07 decision 4): the customer's display
// preferences, under one key, with an allow-listed shape. Nothing else - no token, no API data, no amount,
// no identifier - is ever stored. ESLint allows `localStorage` in this file alone.
//
// Storage can be absent or throw (private windows, blocked site data): every access is guarded and the
// application works with the defaults.
import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';

export const PREFERENCES_KEY = 'finapp.preferences';

export interface Preferences {
  colorScheme: MantineColorScheme;
  language: 'en';
}

export const DEFAULT_PREFERENCES: Preferences = { colorScheme: 'auto', language: 'en' };

const SCHEMES: ReadonlySet<string> = new Set(['light', 'dark', 'auto']);
const LANGUAGES: ReadonlySet<string> = new Set(['en']);

/** Reads only the allow-listed fields; anything else in the stored value is ignored and never re-written. */
export function parsePreferences(raw: string | null): Preferences {
  if (raw === null) return DEFAULT_PREFERENCES;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULT_PREFERENCES;
    const record = value as Record<string, unknown>;
    const colorScheme = record['colorScheme'];
    const language = record['language'];
    return {
      colorScheme:
        typeof colorScheme === 'string' && SCHEMES.has(colorScheme)
          ? (colorScheme as MantineColorScheme)
          : DEFAULT_PREFERENCES.colorScheme,
      language: typeof language === 'string' && LANGUAGES.has(language) ? 'en' : DEFAULT_PREFERENCES.language,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readPreferences(): Preferences {
  try {
    return parsePreferences(storage()?.getItem(PREFERENCES_KEY) ?? null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(change: Partial<Preferences>): void {
  const next: Preferences = { ...readPreferences(), ...change };
  const allowListed: Preferences = { colorScheme: next.colorScheme, language: next.language };
  try {
    storage()?.setItem(PREFERENCES_KEY, JSON.stringify(allowListed));
  } catch {
    // A preference that cannot be kept is simply not kept.
  }
}

/**
 * Mantine's colour-scheme manager, kept inside the preferences key instead of Mantine's own key, so the
 * application has exactly one storage key.
 */
export function preferencesColorSchemeManager(): MantineColorSchemeManager {
  return {
    get: (defaultValue) => {
      const stored = readPreferences().colorScheme;
      return stored === DEFAULT_PREFERENCES.colorScheme ? defaultValue : stored;
    },
    set: (value) => writePreferences({ colorScheme: value }),
    subscribe: () => undefined,
    unsubscribe: () => undefined,
    clear: () => writePreferences({ colorScheme: DEFAULT_PREFERENCES.colorScheme }),
  };
}
