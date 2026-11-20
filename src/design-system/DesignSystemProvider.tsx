// Adapted from finapp-admin-panel/src/design-system/DesignSystemProvider.tsx (ADR-F08).
import './mantine-styles.ts';
import './theme.generated.css';
import './design-system.css';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { preferencesColorSchemeManager } from '../platform/preferences.ts';
import { themeOverride } from './theme.ts';

export interface DesignSystemProviderProps {
  children: ReactNode;
  /** Pins the colour scheme (the catalogue's light/dark runs); otherwise the customer's choice, else the system's. */
  forceColorScheme?: 'light' | 'dark';
  /** `test` disables transitions and portals, so component tests are deterministic. */
  env?: 'default' | 'test';
}

/**
 * Mantine with every inline-<style> injection off: the CSS variables and breakpoint classes come from the
 * static theme.generated.css (ADR-F07 decision 1). The colour-scheme choice lives in the one allow-listed
 * preferences key (ADR-F07 decision 4), not Mantine's own.
 */
export function DesignSystemProvider({ children, forceColorScheme, env = 'default' }: DesignSystemProviderProps) {
  return (
    <MantineProvider
      theme={themeOverride}
      withCssVariables={false}
      withGlobalClasses={false}
      defaultColorScheme="auto"
      colorSchemeManager={preferencesColorSchemeManager()}
      env={env}
      {...(forceColorScheme === undefined ? {} : { forceColorScheme })}
    >
      {children}
    </MantineProvider>
  );
}
