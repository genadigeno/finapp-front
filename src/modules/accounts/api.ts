// The accounts module's reads (P18-TSK-017…-020). Every figure is finapp's, as finapp sent it: amounts stay
// decimal strings, balances say what kind of number they are, nothing is summed or derived here (ADR-F04).
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';

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

export interface StatementLine {
  entryId: string | undefined;
  postingDate: string | undefined;
  valueDate: string | undefined;
  amount: string;
  direction: string | undefined;
  entryType: string | undefined;
  label: string | undefined;
  reference: string | undefined;
}

export interface StatementSection {
  currency: string;
  opening: string | undefined;
  closing: string | undefined;
  lines: StatementLine[];
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
      return {
        kind: data.kind,
        readAt: new Date().toISOString(),
        lines: (data.balances ?? []).flatMap((b) =>
          b.currency === undefined || b.available === undefined || b.settled === undefined || b.holds === undefined
            ? []
            : [{ currency: b.currency, available: b.available, settled: b.settled, holds: b.holds }],
        ),
      };
    },
  });
}

export function useStatement(accountId: string, period: { from: string; to: string } | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: [ACCOUNTS_ROOT, accountId, 'statement', period?.from, period?.to],
    enabled: period !== undefined,
    queryFn: async (): Promise<StatementSection[]> => {
      if (period === undefined) return [];
      const { data } = await ok(
        api.GET('/v1/me/accounts/{id}/statement', {
          params: { path: { id: accountId }, query: { from: period.from, to: period.to } },
        }),
      );
      return (data.sections ?? []).flatMap((s) =>
        s.currency === undefined
          ? []
          : [
              {
                currency: s.currency,
                opening: s.opening,
                closing: s.closing,
                lines: (s.lines ?? []).flatMap((l) =>
                  l.amount === undefined
                    ? []
                    : [
                        {
                          entryId: l.entryId,
                          postingDate: l.postingDate,
                          valueDate: l.valueDate,
                          amount: l.amount,
                          direction: l.direction,
                          entryType: l.entryType,
                          label: l.label,
                          reference: l.reference,
                        },
                      ],
                ),
              },
            ],
      );
    },
  });
}
