// The FX and cross-border module's reads (P18-TSK-025, -026).
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';

export const FX_ROOT = 'fx';
export const XB_ROOT = 'cross-border';

export interface Pair {
  sourceCurrency: string;
  destinationCurrency: string;
  available: boolean;
  sourceMinimum: string | undefined;
  sourceMaximum: string | undefined;
  destinationMinimum: string | undefined;
  destinationMaximum: string | undefined;
}

export function usePairs() {
  const api = useApi();
  return useQuery({
    queryKey: [FX_ROOT, 'pairs'],
    queryFn: async (): Promise<Pair[]> => {
      const { data } = await ok(api.GET('/v1/me/fx/pairs'));
      return (data.pairs ?? []).flatMap((pair) =>
        pair.sourceCurrency === undefined || pair.destinationCurrency === undefined
          ? []
          : [
              {
                sourceCurrency: pair.sourceCurrency,
                destinationCurrency: pair.destinationCurrency,
                available: pair.available === true,
                sourceMinimum: pair.sourceMinimum,
                sourceMaximum: pair.sourceMaximum,
                destinationMinimum: pair.destinationMinimum,
                destinationMaximum: pair.destinationMaximum,
              },
            ],
      );
    },
  });
}

export interface Corridor {
  code: string;
  source: string;
  destination: string;
  country: string | undefined;
  feeFixed: string | undefined;
  feeMargin: string | undefined;
  maximum: string | undefined;
  deliveryEstimateHours: number | undefined;
}

export function useCorridors() {
  const api = useApi();
  return useQuery({
    queryKey: [XB_ROOT, 'corridors'],
    queryFn: async (): Promise<Corridor[]> => {
      const { data } = await ok(api.GET('/v1/me/cross-border/corridors'));
      return (data.corridors ?? []).flatMap((c) =>
        c.corridor === undefined || c.source === undefined || c.destination === undefined
          ? []
          : [
              {
                code: c.corridor,
                source: c.source,
                destination: c.destination,
                country: c.country,
                feeFixed: c.feeFixed,
                feeMargin: c.feeMargin,
                maximum: c.maximum,
                deliveryEstimateHours: c.deliveryEstimateHours,
              },
            ],
      );
    },
  });
}

export interface Recipient {
  id: string;
  nickname: string;
  suffix: string | undefined;
  country: string | undefined;
  currency: string | undefined;
  entityType: string | undefined;
  status: string | undefined;
}

export function useRecipients() {
  const api = useApi();
  return useQuery({
    queryKey: [XB_ROOT, 'recipients'],
    queryFn: async (): Promise<{ recipients: Recipient[]; truncated: boolean }> => {
      const { data } = await ok(api.GET('/v1/me/cross-border/beneficiaries'));
      return {
        truncated: data.truncated === true,
        recipients: (data.beneficiaries ?? []).flatMap((b) =>
          b.id === undefined
            ? []
            : [
                {
                  id: b.id,
                  nickname: b.nickname ?? '',
                  suffix: b.suffix,
                  country: b.country,
                  currency: b.currency,
                  entityType: b.entityType,
                  status: b.status,
                },
              ],
        ),
      };
    },
  });
}
