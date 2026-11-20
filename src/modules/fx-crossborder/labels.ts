// Customer words and figures for FX and cross-border (read against finapp 5227f57e2).
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { StatusPresentation } from '../../design-system/status.ts';

const m = defineMessages({
  checking: { id: 'xb.recipient.checking', defaultMessage: 'Being checked' },
  ready: { id: 'xb.recipient.ready', defaultMessage: 'Ready to pay' },
  unavailable: { id: 'xb.recipient.unavailable', defaultMessage: 'Not available' },
  removed: { id: 'xb.recipient.removed', defaultMessage: 'Removed' },
  individual: { id: 'xb.entity.individual', defaultMessage: 'Person' },
  business: { id: 'xb.entity.business', defaultMessage: 'Business' },
  booked: { id: 'fx.trade.booked', defaultMessage: 'Exchanged' },
  reversed: { id: 'fx.trade.reversed', defaultMessage: 'Reversed' },
});

const p = (tone: StatusPresentation['tone'], label: MessageDescriptor, terminal: boolean): StatusPresentation => ({
  tone,
  label,
  terminal,
});

/**
 * finapp's customer-shaped beneficiary statuses. UNAVAILABLE never says why - a block is never revealed
 * (INV-RSK-08, tipping-off rules).
 */
export type RecipientStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'UNAVAILABLE' | 'REVOKED';
export const RECIPIENT_STATUS = {
  PENDING_VERIFICATION: p('info', m.checking, false),
  ACTIVE: p('positive', m.ready, false),
  UNAVAILABLE: p('neutral', m.unavailable, false),
  REVOKED: p('neutral', m.removed, true),
} as const satisfies Record<RecipientStatus, StatusPresentation>;

/**
 * A booked exchange (`FxTradeView.status`). An operator may reverse one later (D-R WP-2). Any other value is shown
 * through presentStatus's "in progress" fallback, never as exchanged.
 */
export type FxTradeStatus = 'BOOKED' | 'REVERSED';
export const FX_TRADE_STATUS = {
  BOOKED: p('positive', m.booked, false),
  REVERSED: p('caution', m.reversed, true),
} as const satisfies Record<FxTradeStatus, StatusPresentation>;

/** A region code in the customer's language; the code itself when the browser does not know it. */
export function countryName(code: string | undefined, locale: string): string {
  if (code === undefined) return '';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function entityName(entityType: string | undefined): MessageDescriptor | undefined {
  return entityType === 'INDIVIDUAL' ? m.individual : entityType === 'BUSINESS' ? m.business : undefined;
}

// Moved to the design system in Stage 5 (credit shows rates too).
export { fractionToPercent } from '../../design-system/money.ts';

/** Whole hours as days and hours, for a delivery estimate ("about 2 days"). */
export function deliveryEstimate(hours: number | undefined): { days: number } | { hours: number } | undefined {
  if (hours === undefined || !Number.isInteger(hours) || hours < 0) return undefined;
  return hours >= 24 ? { days: Math.ceil(hours / 24) } : { hours };
}
