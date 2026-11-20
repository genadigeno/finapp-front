// The FX and cross-border module's reads (P18-TSK-025, -026; D-R WP-2).
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../platform/api/api-context.tsx';
import { ApiError } from '../../platform/api/api-error.ts';
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

/** A missing, malformed or not-yours id: finapp answers 404 (400 for a malformed one); the page says one thing. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

/**
 * One conversion's receipt (D-R WP-2). Re-read on every view: an operator may reverse a booked exchange later, and
 * only this read shows it. Amounts and the executed rate stay finapp's strings.
 */
export function useConversion(tradeId: string) {
  const api = useApi();
  return useQuery({
    queryKey: [FX_ROOT, 'conversion', tradeId],
    queryFn: async () => (await ok(api.GET('/v1/me/fx/conversions/{tradeId}', { params: { path: { tradeId } } }))).data,
    refetchOnMount: 'always',
  });
}

/**
 * The offer a payment abroad was made on - what the customer agreed (D-R WP-2). Read once per page view: no polling,
 * no refetch, no retry, and kept out of the cross-border root so a cancellation's invalidation does not re-read it.
 * Its status is the OFFER's and is never shown as the payment's.
 */
export const XB_AGREED_ROOT = 'cross-border-agreed';
export function useAgreedOffer(quoteId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: [XB_AGREED_ROOT, quoteId],
    enabled: quoteId !== undefined,
    queryFn: async () =>
      (await ok(api.GET('/v1/me/cross-border/quotes/{id}', { params: { path: { id: quoteId ?? '' } } }))).data,
    staleTime: Infinity,
    // Dropped when the page is left, so the next view reads it once again.
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** One overseas recipient, removed ones included (a past payment still names who it went to). */
export function useRecipient(beneficiaryId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: [XB_ROOT, 'recipient', beneficiaryId],
    enabled: beneficiaryId !== undefined,
    queryFn: async () =>
      (await ok(api.GET('/v1/me/cross-border/beneficiaries/{id}', { params: { path: { id: beneficiaryId ?? '' } } })))
        .data,
    retry: false,
  });
}
