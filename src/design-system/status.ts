// Customer wording and tone for every status finapp shows a customer (blueprint §7; ADR-F05 decision 6).
//
// One map per status enum, each EXHAUSTIVE over the values the contract documents (`satisfies Record<…>`
// fails the build if a value is missing). A value a map does not know - a newer finapp's - is shown as
// "In progress - check back", never as an error and never as success (StatusChip).
//
// No status that may hide a risk or compliance decision says why (INV-RSK-08): HELD and FAILED name no
// reason.
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { Tone } from './tone.ts';

export interface StatusPresentation {
  tone: Tone;
  label: MessageDescriptor;
  /** True when the operation has finished and its status will not change again. */
  terminal: boolean;
}

const m = defineMessages({
  inProgress: { id: 'status.inProgress', defaultMessage: 'In progress' },
  completed: { id: 'status.completed', defaultMessage: 'Completed' },
  failed: { id: 'status.failed', defaultMessage: 'Not completed' },
  reversed: { id: 'status.reversed', defaultMessage: 'Reversed' },
  needsConfirmation: { id: 'status.needsConfirmation', defaultMessage: 'Waiting for your confirmation' },
  processing: { id: 'status.processing', defaultMessage: 'Processing' },
  succeeded: { id: 'status.succeeded', defaultMessage: 'Paid' },
  cancelled: { id: 'status.cancelled', defaultMessage: 'Cancelled' },
  sentToBank: { id: 'status.sentToBank', defaultMessage: 'Sent to your bank' },
  confirming: { id: 'status.confirming', defaultMessage: 'Being confirmed' },
  quoted: { id: 'status.quoted', defaultMessage: 'Quote ready' },
  accepted: { id: 'status.accepted', defaultMessage: 'Accepted' },
  exchanged: { id: 'status.exchanged', defaultMessage: 'Exchanged' },
  notUsed: { id: 'status.notUsed', defaultMessage: 'Not used' },
  expired: { id: 'status.expired', defaultMessage: 'Expired' },
  sent: { id: 'status.sent', defaultMessage: 'Sent' },
  delivered: { id: 'status.delivered', defaultMessage: 'Delivered' },
  returned: { id: 'status.returned', defaultMessage: 'Returned' },
  started: { id: 'status.started', defaultMessage: 'Started' },
  underReview: { id: 'status.underReview', defaultMessage: 'Under review' },
  awaitingDecision: { id: 'status.awaitingDecision', defaultMessage: 'Awaiting a decision' },
  verified: { id: 'status.verified', defaultMessage: 'Verified' },
  notVerified: { id: 'status.notVerified', defaultMessage: 'Not verified' },
  pendingPayout: { id: 'status.pendingPayout', defaultMessage: 'Being paid out' },
  active: { id: 'status.active', defaultMessage: 'Active' },
  closing: { id: 'status.closing', defaultMessage: 'Closing' },
  closed: { id: 'status.closed', defaultMessage: 'Closed' },
  writtenOff: { id: 'status.writtenOff', defaultMessage: 'Written off - still owed' },
  received: { id: 'status.received', defaultMessage: 'Received' },
  checking: { id: 'status.checking', defaultMessage: 'Being checked' },
  decided: { id: 'status.decided', defaultMessage: 'Decided' },
  lapsed: { id: 'status.lapsed', defaultMessage: 'Closed without a decision' },
  approved: { id: 'status.approved', defaultMessage: 'Approved' },
  notApproved: { id: 'status.notApproved', defaultMessage: 'Not approved' },
  offerReady: { id: 'status.offerReady', defaultMessage: 'Offer ready' },
  withdrawn: { id: 'status.withdrawn', defaultMessage: 'Withdrawn' },
  waitingForYou: { id: 'status.waitingForYou', defaultMessage: 'Waiting for your answer' },
  declined: { id: 'status.declined', defaultMessage: 'Declined' },
  upcoming: { id: 'status.upcoming', defaultMessage: 'Upcoming' },
  due: { id: 'status.due', defaultMessage: 'Due' },
  partlyPaid: { id: 'status.partlyPaid', defaultMessage: 'Partly paid' },
  paid: { id: 'status.paid', defaultMessage: 'Paid' },
  awaitingPayment: { id: 'status.awaitingPayment', defaultMessage: 'Waiting for payment' },
  open: { id: 'status.open', defaultMessage: 'Open' },
  sellerResponded: { id: 'status.sellerResponded', defaultMessage: 'The seller has responded' },
  refunded: { id: 'status.refunded', defaultMessage: 'Refunded' },
  noRefund: { id: 'status.noRefund', defaultMessage: 'Closed without a refund' },
  unknown: { id: 'status.unknown', defaultMessage: 'In progress - check back' },
});

const p = (tone: Tone, label: MessageDescriptor, terminal: boolean): StatusPresentation => ({ tone, label, terminal });

export type TransferStatus = 'INITIATED' | 'COMPLETED' | 'FAILED' | 'REVERSED';
export const TRANSFER_STATUS = {
  INITIATED: p('info', m.inProgress, false),
  COMPLETED: p('positive', m.completed, true),
  FAILED: p('critical', m.failed, true),
  REVERSED: p('neutral', m.reversed, true),
} as const satisfies Record<TransferStatus, StatusPresentation>;

export type PaymentIntentStatus = 'REQUIRES_CONFIRMATION' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export const PAYMENT_INTENT_STATUS = {
  REQUIRES_CONFIRMATION: p('caution', m.needsConfirmation, false),
  PROCESSING: p('info', m.processing, false),
  SUCCEEDED: p('positive', m.succeeded, true),
  FAILED: p('critical', m.failed, true),
  CANCELLED: p('neutral', m.cancelled, true),
} as const satisfies Record<PaymentIntentStatus, StatusPresentation>;

export type WithdrawalStatus = 'DISPATCHED' | 'COMPLETED' | 'FAILED' | 'UNKNOWN' | 'HELD';
export const WITHDRAWAL_STATUS = {
  DISPATCHED: p('info', m.sentToBank, false),
  COMPLETED: p('positive', m.completed, true),
  FAILED: p('critical', m.failed, true),
  // The rail did not say; finapp is finding out. Never shown as failure.
  UNKNOWN: p('caution', m.confirming, false),
  // A risk hold looks like any withdrawal in progress: no reason, no deadline, no hint of review (INV-RSK-08;
  // finapp ERROR_CONTRACT.md withdrawals).
  HELD: p('info', m.processing, false),
} as const satisfies Record<WithdrawalStatus, StatusPresentation>;

export type FxQuoteStatus = 'ISSUED' | 'ACCEPTED' | 'EXECUTED' | 'ABANDONED' | 'EXPIRED' | 'CANCELLED';
export const FX_QUOTE_STATUS = {
  ISSUED: p('info', m.quoted, false),
  ACCEPTED: p('info', m.accepted, false),
  EXECUTED: p('positive', m.exchanged, true),
  ABANDONED: p('neutral', m.notUsed, true),
  EXPIRED: p('neutral', m.expired, true),
  CANCELLED: p('neutral', m.cancelled, true),
} as const satisfies Record<FxQuoteStatus, StatusPresentation>;

export type CrossBorderStatus = 'PROCESSING' | 'SENT' | 'DELIVERED' | 'RETURNED' | 'FAILED' | 'CANCELLED';
export const CROSS_BORDER_STATUS = {
  PROCESSING: p('info', m.processing, false),
  SENT: p('info', m.sent, false),
  DELIVERED: p('positive', m.delivered, true),
  RETURNED: p('caution', m.returned, true),
  FAILED: p('critical', m.failed, true),
  CANCELLED: p('neutral', m.cancelled, true),
} as const satisfies Record<CrossBorderStatus, StatusPresentation>;

export type KycStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_DECISION' | 'APPROVED' | 'REJECTED';
export const KYC_STATUS = {
  OPEN: p('neutral', m.started, false),
  IN_PROGRESS: p('info', m.underReview, false),
  PENDING_DECISION: p('info', m.awaitingDecision, false),
  APPROVED: p('positive', m.verified, true),
  REJECTED: p('critical', m.notVerified, true),
} as const satisfies Record<KycStatus, StatusPresentation>;

export type LoanStatus = 'PENDING_DISBURSEMENT' | 'ACTIVE' | 'CLOSING' | 'CLOSED' | 'CANCELLED' | 'WRITTEN_OFF';
export const LOAN_STATUS = {
  PENDING_DISBURSEMENT: p('info', m.pendingPayout, false),
  ACTIVE: p('positive', m.active, false),
  CLOSING: p('info', m.closing, false),
  CLOSED: p('neutral', m.closed, true),
  CANCELLED: p('neutral', m.cancelled, true),
  // finapp stops collecting, but the balance is still owed: never shown as settled.
  WRITTEN_OFF: p('caution', m.writtenOff, true),
} as const satisfies Record<LoanStatus, StatusPresentation>;

// Stage 5 (credit). Each enum as finapp's credit, lending, bnpl and checkout modules define it at 5227f57e2.

export type CreditRequestStatus =
  'SUBMITTED' | 'COLLECTING' | 'READY' | 'EVALUATED' | 'IN_REVIEW' | 'DECIDED' | 'CANCELLED' | 'EXPIRED' | 'ABANDONED';
export const CREDIT_REQUEST_STATUS = {
  SUBMITTED: p('info', m.received, false),
  COLLECTING: p('info', m.checking, false),
  READY: p('info', m.checking, false),
  EVALUATED: p('info', m.checking, false),
  // A person is looking at it. No reason is given (INV-CRD-02, INV-RSK-08).
  IN_REVIEW: p('info', m.underReview, false),
  DECIDED: p('neutral', m.decided, true),
  CANCELLED: p('neutral', m.cancelled, true),
  EXPIRED: p('neutral', m.lapsed, true),
  ABANDONED: p('neutral', m.lapsed, true),
} as const satisfies Record<CreditRequestStatus, StatusPresentation>;

export type CreditOutcome = 'APPROVED' | 'DECLINED';
export const CREDIT_OUTCOME = {
  APPROVED: p('positive', m.approved, true),
  DECLINED: p('neutral', m.notApproved, true),
} as const satisfies Record<CreditOutcome, StatusPresentation>;

/** Loan and pay-later applications share one lifecycle. */
export type ApplicationStatus =
  'SUBMITTED' | 'AWAITING_DECISION' | 'OFFERED' | 'DECLINED' | 'CLOSED_UNDECIDED' | 'WITHDRAWN';
export const APPLICATION_STATUS = {
  SUBMITTED: p('info', m.received, false),
  AWAITING_DECISION: p('info', m.awaitingDecision, false),
  OFFERED: p('positive', m.offerReady, true),
  DECLINED: p('neutral', m.notApproved, true),
  CLOSED_UNDECIDED: p('neutral', m.lapsed, true),
  WITHDRAWN: p('neutral', m.withdrawn, true),
} as const satisfies Record<ApplicationStatus, StatusPresentation>;

export type OfferStatus = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export const OFFER_STATUS = {
  OFFERED: p('caution', m.waitingForYou, false),
  ACCEPTED: p('positive', m.accepted, true),
  DECLINED: p('neutral', m.declined, true),
  EXPIRED: p('neutral', m.expired, true),
} as const satisfies Record<OfferStatus, StatusPresentation>;

export type InstalmentStatus = 'UNBILLED' | 'DUE' | 'PARTIALLY_PAID' | 'PAID';
export const INSTALMENT_STATUS = {
  UNBILLED: p('neutral', m.upcoming, false),
  DUE: p('caution', m.due, false),
  PARTIALLY_PAID: p('caution', m.partlyPaid, false),
  PAID: p('positive', m.paid, true),
} as const satisfies Record<InstalmentStatus, StatusPresentation>;

export type BnplAgreementStatus = 'ACTIVE' | 'CLOSED' | 'WRITTEN_OFF';
export const BNPL_AGREEMENT_STATUS = {
  ACTIVE: p('positive', m.active, false),
  CLOSED: p('neutral', m.closed, true),
  WRITTEN_OFF: p('caution', m.writtenOff, true),
} as const satisfies Record<BnplAgreementStatus, StatusPresentation>;

export type DisputeStatus = 'OPEN' | 'MERCHANT_RESPONDED' | 'RESOLVED_REFUND' | 'RESOLVED_UPHELD' | 'WITHDRAWN';
export const DISPUTE_STATUS = {
  OPEN: p('info', m.open, false),
  MERCHANT_RESPONDED: p('info', m.sellerResponded, false),
  RESOLVED_REFUND: p('positive', m.refunded, true),
  RESOLVED_UPHELD: p('neutral', m.noRefund, true),
  WITHDRAWN: p('neutral', m.withdrawn, true),
} as const satisfies Record<DisputeStatus, StatusPresentation>;

export type CheckoutStatus = 'OPEN' | 'PAYMENT_PENDING' | 'COMPLETED' | 'COMPLETED_LATE' | 'EXPIRED' | 'ABANDONED';
export const CHECKOUT_STATUS = {
  OPEN: p('info', m.awaitingPayment, false),
  // A declined payment also stays here until the session expires: never shown as failure or success.
  PAYMENT_PENDING: p('info', m.processing, false),
  COMPLETED: p('positive', m.paid, true),
  COMPLETED_LATE: p('positive', m.paid, true),
  EXPIRED: p('neutral', m.expired, true),
  ABANDONED: p('neutral', m.cancelled, true),
} as const satisfies Record<CheckoutStatus, StatusPresentation>;

export type StatusMap = Readonly<Record<string, StatusPresentation>>;

export const UNKNOWN_STATUS: StatusPresentation = p('neutral', m.unknown, false);

/** The presentation of `value`; an unknown value is "in progress - check back", never an error. */
export function presentStatus(value: string, map: StatusMap): StatusPresentation {
  return Object.hasOwn(map, value) ? (map[value] ?? UNKNOWN_STATUS) : UNKNOWN_STATUS;
}
