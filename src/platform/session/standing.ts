// The customer's standing, read from finapp - never inferred locally (ADR-F06).
//
// Today `GET /v1/me` gives the party's kind and identity. Customer status and the actions finapp requires
// next are gap G-08; until finapp adds them, standing says only what the profile supports and routing
// never guesses the rest.
import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useApi } from '../api/api-context.tsx';
import { ok } from '../api/client.ts';
import { sessionState, subscribeSession, type SessionState } from './session-store.ts';

export type PartyKind = 'PERSON' | 'ORGANISATION' | 'UNKNOWN';

export interface Standing {
  partyKind: PartyKind;
  displayName: string | undefined;
  /** The customer's own reference: shared by an owner with a business that declares them (KYB). */
  partyId: string | undefined;
}

export function toPartyKind(value: string | undefined): PartyKind {
  return value === 'PERSON' || value === 'ORGANISATION' ? value : 'UNKNOWN';
}

export const standingQueryKey = ['me', 'profile'] as const;

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, sessionState, sessionState);
}

/** The signed-in customer's standing; disabled while signed out. */
export function useStanding() {
  const api = useApi();
  const session = useSession();
  return useQuery({
    queryKey: standingQueryKey,
    enabled: session.status === 'signed-in',
    queryFn: async (): Promise<Standing> => {
      const { data } = await ok(api.GET('/v1/me'));
      return { partyKind: toPartyKind(data.kind), displayName: data.displayName, partyId: data.partyId };
    },
  });
}
