// The customer's wallets, shared by every module that moves or shows money (accounts, move-money,
// fx-crossborder): a module may not import another module, so the reads live here (moved from
// src/modules/accounts/api.ts in Stage 4). Every figure is finapp's, as finapp sent it (ADR-F04).
import { useQueries, useQuery } from '@tanstack/react-query';
import { useApi } from '../api/api-context.tsx';
import { ok } from '../api/client.ts';

export const ACCOUNTS_ROOT = 'accounts';

export interface Account {
  id: string;
  productType: string | undefined;
  status: string | undefined;
  openedAt: string | undefined;
}

export interface BalanceLine {
  currency: string;
  available: string;
  settled: string;
  holds: string;
}

export interface Balances {
  kind: string | undefined;
  lines: BalanceLine[];
  /** When this answer was read: the "as of" every balance shows (blueprint §13). */
  readAt: string;
}

type BalanceResponse = {
  kind?: string;
  balances?: { currency?: string; available?: string; settled?: string; holds?: string }[];
};

function toBalances(data: BalanceResponse): Balances {
  return {
    kind: data.kind,
    readAt: new Date().toISOString(),
    lines: (data.balances ?? []).flatMap((b) =>
      b.currency === undefined || b.available === undefined || b.settled === undefined || b.holds === undefined
        ? []
        : [{ currency: b.currency, available: b.available, settled: b.settled, holds: b.holds }],
    ),
  };
}

export function useAccounts() {
  const api = useApi();
  return useQuery({
    queryKey: [ACCOUNTS_ROOT, 'list'],
    queryFn: async (): Promise<Account[]> => {
      const { data } = await ok(api.GET('/v1/me/accounts'));
      return data.flatMap((a) =>
        a.id === undefined ? [] : [{ id: a.id, productType: a.productType, status: a.status, openedAt: a.openedAt }],
      );
    },
  });
}

export function useBalances(accountId: string) {
  const api = useApi();
  return useQuery({
    queryKey: [ACCOUNTS_ROOT, accountId, 'balances'],
    queryFn: async (): Promise<Balances> => {
      const { data } = await ok(api.GET('/v1/me/accounts/{id}/balances', { params: { path: { id: accountId } } }));
      return toBalances(data);
    },
  });
}

/** One currency of one live wallet: where money can be sent from or into. */
export interface Pocket {
  accountId: string;
  currency: string;
  available: string;
}

/**
 * Every currency of every live wallet, with its available balance as finapp projects it. Used to choose where money
 * comes from; finapp alone decides whether there is enough.
 */
export function usePockets() {
  const accounts = useAccounts();
  const live = (accounts.data ?? []).filter((a) => a.status !== 'CLOSED');
  const api = useApi();
  const balances = useQueries({
    queries: live.map((account) => ({
      queryKey: [ACCOUNTS_ROOT, account.id, 'balances'],
      queryFn: async (): Promise<Balances> => {
        const { data } = await ok(api.GET('/v1/me/accounts/{id}/balances', { params: { path: { id: account.id } } }));
        return toBalances(data);
      },
    })),
  });
  const pockets: Pocket[] = [];
  live.forEach((account, index) => {
    for (const line of balances[index]?.data?.lines ?? []) {
      pockets.push({ accountId: account.id, currency: line.currency, available: line.available });
    }
  });
  return {
    pockets,
    isPending: accounts.isPending || balances.some((b) => b.isPending),
    error: accounts.error ?? balances.find((b) => b.error !== null)?.error ?? null,
    refetch: () => void accounts.refetch(),
  };
}
