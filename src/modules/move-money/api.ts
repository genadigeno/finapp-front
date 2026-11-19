// The move-money module's reads (P18-TSK-021…-024).
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';

export const BENEFICIARIES_ROOT = 'beneficiaries';
export const PAYMENT_METHODS_ROOT = 'payment-methods';

export interface Beneficiary {
  id: string;
  displayName: string;
  destinationAccountId: string | undefined;
  createdAt: string | undefined;
}

export function useBeneficiaries() {
  const api = useApi();
  return useQuery({
    queryKey: [BENEFICIARIES_ROOT],
    queryFn: async (): Promise<Beneficiary[]> => {
      const { data } = await ok(api.GET('/v1/beneficiaries'));
      return data.flatMap((b) =>
        b.id === undefined
          ? []
          : [
              {
                id: b.id,
                displayName: b.displayName ?? '',
                destinationAccountId: b.destinationAccountId,
                createdAt: b.createdAt,
              },
            ],
      );
    },
  });
}

export interface PaymentMethod {
  id: string;
  kind: string | undefined;
  brand: string | undefined;
  displaySuffix: string | undefined;
  expiryMonth: number | undefined;
  expiryYear: number | undefined;
  payeeCheck: string | undefined;
}

export function usePaymentMethods() {
  const api = useApi();
  return useQuery({
    queryKey: [PAYMENT_METHODS_ROOT],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const { data } = await ok(api.GET('/v1/me/payment-methods'));
      return data.flatMap((m) =>
        m.id === undefined
          ? []
          : [
              {
                id: m.id,
                kind: m.kind,
                brand: m.brand,
                displaySuffix: m.displaySuffix,
                expiryMonth: m.expiryMonth,
                expiryYear: m.expiryYear,
                payeeCheck: m.payeeCheck,
              },
            ],
      );
    },
  });
}
