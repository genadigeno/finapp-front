// Customer words for the move-money module's finapp values (read against finapp 5227f57e2).
import { defineMessages, type MessageDescriptor } from 'react-intl';

const m = defineMessages({
  card: { id: 'method.card', defaultMessage: 'Card' },
  bank: { id: 'method.bank', defaultMessage: 'Bank account' },
  other: { id: 'method.other', defaultMessage: 'Payment method' },
  payeeMatch: { id: 'method.payee.match', defaultMessage: 'The name on the account matches yours' },
  payeeClose: { id: 'method.payee.close', defaultMessage: 'The name on the account is close to yours' },
  payeeNoMatch: { id: 'method.payee.noMatch', defaultMessage: 'The name on the account did not match yours' },
  payeeUnavailable: { id: 'method.payee.unavailable', defaultMessage: 'The name on the account could not be checked' },
  declined: {
    id: 'payment.failure.declined',
    defaultMessage: 'Your card or bank declined the payment. Nothing was added to your wallet.',
  },
  generic: {
    id: 'payment.failure.generic',
    defaultMessage: 'The payment did not go through. Nothing was added to your wallet.',
  },
  withdrawalFailed: {
    id: 'withdrawal.failure.generic',
    defaultMessage: 'The withdrawal did not go through. The money is back in your wallet.',
  },
  withdrawalDeclined: {
    id: 'withdrawal.failure.declined',
    defaultMessage: 'Your bank refused the money. It is back in your wallet.',
  },
});

/**
 * Whether finapp reported an amount other than zero. The decimal string is read as text - a zero is written only
 * with zeros - so nothing is converted to a number (ADR-F04).
 */
export function isNonZero(amount: string | undefined): amount is string {
  return amount !== undefined && /[1-9]/.test(amount);
}

export function methodKind(kind: string | undefined): MessageDescriptor {
  return kind === 'CARD_TOKEN' ? m.card : kind === 'BANK_ACCOUNT' ? m.bank : m.other;
}

export function payeeCheckWords(check: string | undefined): MessageDescriptor | undefined {
  switch (check) {
    case 'MATCH':
      return m.payeeMatch;
    case 'CLOSE_MATCH':
      return m.payeeClose;
    case 'NO_MATCH':
      return m.payeeNoMatch;
    case 'UNAVAILABLE':
      return m.payeeUnavailable;
    default:
      return undefined;
  }
}

/** A failed top-up: "declined" is the customer's bank's word; anything else - including a risk refusal - is generic. */
export function topUpFailure(reason: string | undefined): MessageDescriptor {
  return reason === 'DECLINED' ? m.declined : m.generic;
}

/** A failed withdrawal: a risk refusal reads like any other failure (INV-RSK-08). */
export function withdrawalFailure(reason: string | undefined): MessageDescriptor {
  return reason === 'DECLINED' ? m.withdrawalDeclined : m.withdrawalFailed;
}

/** A pay-by-bank authorisation link is followed only if it is an https URL (it leaves this origin by design). */
export function safeAuthorizationUrl(handle: string | undefined): string | undefined {
  if (handle === undefined) return undefined;
  try {
    const url = new URL(handle);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
