// Adapted from finapp-admin-panel/src/platform/api/api-context.tsx (ADR-F08).
import { createContext, use, type ReactNode } from 'react';
import type { FinappClient } from './client.ts';

const ApiContext = createContext<FinappClient | undefined>(undefined);

/** Provides the one typed client the application uses (tests provide one over a scripted transport). */
export function ApiProvider({ client, children }: { client: FinappClient; children: ReactNode }) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

export function useApi(): FinappClient {
  const client = use(ApiContext);
  if (client === undefined) throw new Error('useApi() needs an <ApiProvider>.');
  return client;
}
