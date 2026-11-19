// The customer's saved cards and bank accounts, shared by move-money (top-up, withdrawal) and credit (checkout):
// a module may not import another module, so the read lives here (moved from src/modules/move-money/api.ts in
// Stage 5).
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/api-context.tsx';
import { ok } from '../api/client.ts';

export const PAYMENT_METHODS_ROOT = 'payment-methods';

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
