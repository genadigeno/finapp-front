// Customer words for credit, pay later and checkout (read against finapp 5227f57e2). Product and plan codes are
// finapp's; a code this map does not know is shown as finapp sent it, never guessed.
import { defineMessages, type MessageDescriptor } from 'react-intl';

const products = defineMessages({
  PERSONAL_LOAN: { id: 'credit.product.loan', defaultMessage: 'Personal loan' },
  CREDIT_LINE: { id: 'credit.product.line', defaultMessage: 'Credit line' },
  BNPL_PAY_IN_4: { id: 'credit.product.payIn4', defaultMessage: 'Pay in 4' },
  BNPL_PAY_IN_N: { id: 'credit.product.payMonthly', defaultMessage: 'Pay monthly' },
});

const plans = defineMessages({
  PAY_IN_4: { id: 'credit.plan.payIn4', defaultMessage: 'Pay in 4' },
  PAY_IN_3_MONTHS: { id: 'credit.plan.3', defaultMessage: '3 monthly payments' },
  PAY_IN_6_MONTHS: { id: 'credit.plan.6', defaultMessage: '6 monthly payments' },
  PAY_IN_12_MONTHS: { id: 'credit.plan.12', defaultMessage: '12 monthly payments' },
});

const categories = defineMessages({
  NOT_RECEIVED: { id: 'credit.dispute.notReceived', defaultMessage: 'I did not receive it' },
  NOT_AS_DESCRIBED: { id: 'credit.dispute.notAsDescribed', defaultMessage: 'It was not as described' },
  RETURNED_NOT_REFUNDED: { id: 'credit.dispute.returned', defaultMessage: 'I returned it and was not refunded' },
  OTHER: { id: 'credit.dispute.other', defaultMessage: 'Something else' },
});

function lookup<K extends string>(
  map: Record<K, MessageDescriptor>,
  code: string | undefined,
): MessageDescriptor | undefined {
  return code !== undefined && Object.hasOwn(map, code) ? map[code as K] : undefined;
}

/** finapp lends in euro only (reference jurisdiction EU-REF); pay-later illustrations carry no currency. */
export const CREDIT_CURRENCY = 'EUR';

/** The two products a customer can apply for here; pay later starts at a shop's checkout. */
export const APPLICABLE_PRODUCTS = ['PERSONAL_LOAN', 'CREDIT_LINE'] as const;
export type ApplicableProduct = (typeof APPLICABLE_PRODUCTS)[number];

export const productName = (code: string | undefined) => lookup(products, code);
export const planName = (code: string | undefined) => lookup(plans, code);

export const DISPUTE_CATEGORIES = ['NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'RETURNED_NOT_REFUNDED', 'OTHER'] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];
export const categoryName = (code: DisputeCategory) => categories[code];

/** A loan is a credit line when finapp says so; everything else is an instalment loan. */
export const isLine = (product: string | undefined) => product === 'CREDIT_LINE';

/** Terms finapp lends over, in months (finapp refuses others with lending.AmountOutOfRange or a closed application). */
export const TERM_CHOICES = ['6', '12', '18', '24', '36', '48', '60'] as const;

/** Days of the month a repayment can fall on. */
export const REPAYMENT_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));

/** Only an https link from finapp is ever followed. */
export function isHttpsLink(value: string | undefined): value is string {
  if (value === undefined) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
