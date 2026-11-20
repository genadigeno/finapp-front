// The credit module's reads (P18-TSK-028…-030). Every figure, date and status is finapp's, shown as sent
// (ADR-F04): nothing here adds, subtracts or decides.
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { FRESH_ON_VIEW } from '../../platform/query/query-client.ts';

export const CREDIT_ROOT = 'credit';

export function useCreditProfile() {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'profile'],
    queryFn: async () => (await ok(api.GET('/v1/me/credit/profile'))).data,
  });
}

/** Newest first; finapp returns at most 100 and says nothing when it stops (no `truncated` flag). */
export function useLoans() {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'loans'],
    queryFn: async () => (await ok(api.GET('/v1/me/loans'))).data.loans ?? [],
  });
}

export function useLoan(loanId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'loan', loanId],
    ...FRESH_ON_VIEW,
    queryFn: async () => ok(api.GET('/v1/me/loans/{id}', { params: { path: { id: loanId } } })),
    enabled,
  });
}

export function useLoanSchedule(loanId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'loan', loanId, 'schedule'],
    ...FRESH_ON_VIEW,
    queryFn: async () => (await ok(api.GET('/v1/me/loans/{id}/schedule', { params: { path: { id: loanId } } }))).data,
    enabled,
  });
}

export function useLoanRepayments(loanId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'loan', loanId, 'repayments'],
    ...FRESH_ON_VIEW,
    queryFn: async () =>
      (await ok(api.GET('/v1/me/loans/{id}/repayments', { params: { path: { id: loanId } } }))).data.repayments ?? [],
    enabled,
  });
}

export function useLoanStatements(loanId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'loan', loanId, 'statements'],
    ...FRESH_ON_VIEW,
    queryFn: async () =>
      (await ok(api.GET('/v1/me/loans/{id}/statements', { params: { path: { id: loanId } } }))).data.statements ?? [],
    enabled,
  });
}

/** At most 100 (no `truncated` flag). */
export function useBnplAgreements() {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'bnpl'],
    queryFn: async () => (await ok(api.GET('/v1/me/bnpl-agreements'))).data.agreements ?? [],
  });
}

export function useBnplAgreement(agreementId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'bnpl', agreementId],
    ...FRESH_ON_VIEW,
    queryFn: async () => ok(api.GET('/v1/me/bnpl-agreements/{id}', { params: { path: { id: agreementId } } })),
    enabled,
  });
}

export function useBnplSchedule(agreementId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'bnpl', agreementId, 'schedule'],
    ...FRESH_ON_VIEW,
    queryFn: async () =>
      (await ok(api.GET('/v1/me/bnpl-agreements/{id}/schedule', { params: { path: { id: agreementId } } }))).data,
    enabled,
  });
}

export function useBnplRepayments(agreementId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [CREDIT_ROOT, 'bnpl', agreementId, 'repayments'],
    ...FRESH_ON_VIEW,
    queryFn: async () =>
      (await ok(api.GET('/v1/me/bnpl-agreements/{id}/repayments', { params: { path: { id: agreementId } } }))).data
        .repayments ?? [],
    enabled,
  });
}

/** Which kind of credit a shared page serves: an instalment loan or credit line, or a pay-later plan. */
export type CreditKind = 'loan' | 'bnpl';
