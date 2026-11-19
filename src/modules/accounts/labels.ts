// Customer words for the accounts module's finapp values (read against finapp 5227f57e2).
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { StatusPresentation } from '../../design-system/status.ts';

const m = defineMessages({
  wallet: { id: 'account.product.wallet', defaultMessage: 'Wallet' },
  otherProduct: { id: 'account.product.other', defaultMessage: 'Account' },
  pending: { id: 'account.status.pending', defaultMessage: 'Being opened' },
  active: { id: 'account.status.active', defaultMessage: 'Open' },
  suspended: { id: 'account.status.suspended', defaultMessage: 'Suspended' },
  closed: { id: 'account.status.closed', defaultMessage: 'Closed' },
  posting: { id: 'statement.type.posting', defaultMessage: 'Transaction' },
  reversal: { id: 'statement.type.reversal', defaultMessage: 'Reversal' },
  adjustment: { id: 'statement.type.adjustment', defaultMessage: 'Account adjustment' },
});

export function productName(productType: string | undefined): MessageDescriptor {
  return productType === 'WALLET' ? m.wallet : m.otherProduct;
}

const p = (tone: StatusPresentation['tone'], label: MessageDescriptor, terminal: boolean): StatusPresentation => ({
  tone,
  label,
  terminal,
});

/** finapp's CustomerAccountStatus. Opening creates ACTIVE; nothing produces PENDING or SUSPENDED yet. */
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export const ACCOUNT_STATUS = {
  PENDING: p('info', m.pending, false),
  ACTIVE: p('positive', m.active, false),
  // No reason is ever shown (INV-RSK-08).
  SUSPENDED: p('caution', m.suspended, false),
  CLOSED: p('neutral', m.closed, true),
} as const satisfies Record<AccountStatus, StatusPresentation>;

/** An account the customer still holds: finapp allows one live wallet per customer (a CLOSED one frees it). */
export function isLive(status: string | undefined): boolean {
  return status !== 'CLOSED';
}

/**
 * A statement line's direction from the customer's side. A wallet is a liability of the platform
 * (credit-normal): a CREDIT to it is money in, a DEBIT money out (finapp TransferExecution). The amount finapp
 * sends is always positive; the sign lives here.
 */
export function directionOf(direction: string | undefined): 'in' | 'out' | undefined {
  if (direction === 'CREDIT') return 'in';
  if (direction === 'DEBIT') return 'out';
  return undefined;
}

/** What a statement line is, in words: finapp labels only adjustments; the type says the rest. */
export function lineName(entryType: string | undefined, label: string | undefined): MessageDescriptor | string {
  if (label !== undefined) return label;
  if (entryType === 'REVERSAL') return m.reversal;
  if (entryType === 'ADJUSTMENT') return m.adjustment;
  return m.posting;
}

/**
 * The currencies finapp holds money in (ledger SupportedCurrencies, at the pinned commit). finapp offers no read
 * of them (G-18), so the list is kept here and finapp's `accounts.UnsupportedCurrency` remains the authority.
 */
export const SUPPORTED_CURRENCIES: readonly string[] = ['EUR', 'GBP', 'USD', 'JPY', 'BHD'];
