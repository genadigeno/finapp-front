// Test-only: renders under the real providers - messages, design system (Mantine's test mode), a fresh
// query client with no retries. Adapted from finapp-admin-panel/src/testing/render.tsx (ADR-F08).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { DesignSystemProvider } from '../design-system/DesignSystemProvider.tsx';
import { AppIntlProvider } from '../platform/i18n/IntlProvider.tsx';

export function renderWithProviders(ui: ReactElement, locale = 'en-GB'): RenderResult {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <AppIntlProvider locale={locale}>
      <QueryClientProvider client={client}>
        <DesignSystemProvider env="test">{ui}</DesignSystemProvider>
      </QueryClientProvider>
    </AppIntlProvider>,
  );
}
