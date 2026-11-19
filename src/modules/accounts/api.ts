// The accounts module's own reads (P18-TSK-019); the wallet reads it shares with other modules live in
// src/platform/customer/wallets.ts.
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { ACCOUNTS_ROOT } from '../../platform/customer/wallets.ts';

export {
  ACCOUNTS_ROOT,
  useAccounts,
  useBalances,
  type Account,
  type BalanceLine,
  type Balances,
} from '../../platform/customer/wallets.ts';

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
