// What a customer is told about a failure: what happened and what to do next (blueprint §7, §11.1;
// DOD-CUST "customer wording"). Never an internal code - only the correlation reference is shown.
//
// Lookup order: the exact problem `code`, then the error's category. Every category has an entry, so
// every failure has words. Messages are react-intl descriptors: the text lives here once, in English,
// and translations key on the ids.
import { defineMessages, type MessageDescriptor } from 'react-intl';
import { ApiError, type ErrorCategory } from './api-error.ts';

export interface Explanation {
  title: MessageDescriptor;
  nextStep: MessageDescriptor;
}

const byCategory = defineMessages({
  validationTitle: { id: 'problem.validation.title', defaultMessage: 'Some details need another look' },
  validationNext: { id: 'problem.validation.next', defaultMessage: 'Check the highlighted fields and try again.' },
  unauthenticatedTitle: { id: 'problem.unauthenticated.title', defaultMessage: 'You have been signed out' },
  unauthenticatedNext: { id: 'problem.unauthenticated.next', defaultMessage: 'Sign in again to continue.' },
  assuranceTitle: { id: 'problem.assurance.title', defaultMessage: 'Please confirm it is you' },
  assuranceNext: { id: 'problem.assurance.next', defaultMessage: 'Enter the code from your authenticator app.' },
  forbiddenTitle: { id: 'problem.forbidden.title', defaultMessage: 'This is not available to you' },
  forbiddenNext: {
    id: 'problem.forbidden.next',
    defaultMessage: 'Your account cannot do this right now. Nothing was changed.',
  },
  notFoundTitle: { id: 'problem.notFound.title', defaultMessage: 'We could not find that' },
  notFoundNext: { id: 'problem.notFound.next', defaultMessage: 'Go back and choose it again from your list.' },
  refusedTitle: { id: 'problem.refused.title', defaultMessage: 'This could not be done' },
  refusedNext: { id: 'problem.refused.next', defaultMessage: 'Nothing was changed. Review the details and try again.' },
  inProgressTitle: { id: 'problem.inProgress.title', defaultMessage: 'Still working on it' },
  inProgressNext: {
    id: 'problem.inProgress.next',
    defaultMessage: 'Your request is being processed. Wait a moment before checking again.',
  },
  staleTitle: { id: 'problem.stale.title', defaultMessage: 'Something changed since you reviewed this' },
  staleNext: { id: 'problem.stale.next', defaultMessage: 'Review the updated details before you confirm.' },
  rateLimitedTitle: { id: 'problem.rateLimited.title', defaultMessage: 'Too many attempts' },
  rateLimitedNext: { id: 'problem.rateLimited.next', defaultMessage: 'Wait a few minutes, then try again.' },
  unavailableTitle: { id: 'problem.unavailable.title', defaultMessage: 'This is temporarily unavailable' },
  unavailableNext: {
    id: 'problem.unavailable.next',
    defaultMessage: 'Nothing was changed. Try again in a few minutes.',
  },
  unknownTitle: { id: 'problem.unknown.title', defaultMessage: 'We did not get a final answer' },
  unknownNext: {
    id: 'problem.unknown.next',
    defaultMessage: 'Your request may already have gone through. Do not send it again - check its status first.',
  },
  defectTitle: { id: 'problem.defect.title', defaultMessage: 'Something went wrong on our side' },
  defectNext: {
    id: 'problem.defect.next',
    defaultMessage: 'Nothing was changed. If it happens again, contact us and quote the reference.',
  },
});

export const CATEGORY_EXPLANATIONS: Readonly<Record<ErrorCategory, Explanation>> = {
  validation: { title: byCategory.validationTitle, nextStep: byCategory.validationNext },
  unauthenticated: { title: byCategory.unauthenticatedTitle, nextStep: byCategory.unauthenticatedNext },
  assurance: { title: byCategory.assuranceTitle, nextStep: byCategory.assuranceNext },
  forbidden: { title: byCategory.forbiddenTitle, nextStep: byCategory.forbiddenNext },
  'not-found': { title: byCategory.notFoundTitle, nextStep: byCategory.notFoundNext },
  refused: { title: byCategory.refusedTitle, nextStep: byCategory.refusedNext },
  'in-progress': { title: byCategory.inProgressTitle, nextStep: byCategory.inProgressNext },
  stale: { title: byCategory.staleTitle, nextStep: byCategory.staleNext },
  'rate-limited': { title: byCategory.rateLimitedTitle, nextStep: byCategory.rateLimitedNext },
  unavailable: { title: byCategory.unavailableTitle, nextStep: byCategory.unavailableNext },
  'unknown-outcome': { title: byCategory.unknownTitle, nextStep: byCategory.unknownNext },
  defect: { title: byCategory.defectTitle, nextStep: byCategory.defectNext },
};

const byCode = defineMessages({
  authFailedTitle: { id: 'problem.code.authenticationFailed.title', defaultMessage: 'Sign-in failed' },
  authFailedNext: {
    id: 'problem.code.authenticationFailed.next',
    defaultMessage: 'Check your login and password and try again.',
  },
  quoteExpiredTitle: { id: 'problem.code.quoteExpired.title', defaultMessage: 'Your quote has expired' },
  quoteExpiredNext: {
    id: 'problem.code.quoteExpired.next',
    defaultMessage: 'Get a new quote to see the current rate.',
  },
  termsChangedTitle: { id: 'problem.code.termsChanged.title', defaultMessage: 'The terms have changed' },
  termsChangedNext: {
    id: 'problem.code.termsChanged.next',
    defaultMessage: 'Read the updated terms before you accept. Nothing was accepted.',
  },
  productNotOfferedTitle: {
    id: 'problem.code.productNotOffered.title',
    defaultMessage: 'This product is not available',
  },
  productNotOfferedNext: {
    id: 'problem.code.productNotOffered.next',
    defaultMessage: 'It is not offered to you at the moment. Nothing was changed.',
  },
  // Stage 2 (identity and onboarding). Each is in finapp's ERROR_CONTRACT.md.
  registrationRefusedTitle: {
    id: 'problem.code.registrationRefused.title',
    defaultMessage: 'We could not open your account',
  },
  registrationRefusedNext: {
    id: 'problem.code.registrationRefused.next',
    defaultMessage: 'Try a different login name. If you already have an account, sign in instead.',
  },
  consentRequiredTitle: { id: 'problem.code.consentRequired.title', defaultMessage: 'Your consent is needed first' },
  consentRequiredNext: {
    id: 'problem.code.consentRequired.next',
    defaultMessage: 'Read and agree to the consent for checking your identity, then try again.',
  },
  reconsentTitle: { id: 'problem.code.reconsentRequired.title', defaultMessage: 'The text has changed' },
  reconsentNext: {
    id: 'problem.code.reconsentRequired.next',
    defaultMessage: 'Read the updated text before you agree. Nothing was recorded.',
  },
  noOpenCaseTitle: { id: 'problem.code.noOpenCase.title', defaultMessage: 'There is no verification in progress' },
  noOpenCaseNext: {
    id: 'problem.code.noOpenCase.next',
    defaultMessage: 'Start verifying your identity before you add documents.',
  },
  ownerNotEligibleTitle: { id: 'problem.code.ownerNotEligible.title', defaultMessage: 'We cannot add this person' },
  ownerNotEligibleNext: {
    id: 'problem.code.ownerNotEligible.next',
    defaultMessage:
      'Check the customer reference. The person must have a FinApp account and have started verifying their identity.',
  },
  ownerDeclaredTitle: { id: 'problem.code.ownerDeclared.title', defaultMessage: 'This person is already listed' },
  ownerDeclaredNext: { id: 'problem.code.ownerDeclared.next', defaultMessage: 'Nothing was changed.' },
  notAcceptingOwnersTitle: {
    id: 'problem.code.notAcceptingOwners.title',
    defaultMessage: 'Owners can no longer be added',
  },
  notAcceptingOwnersNext: {
    id: 'problem.code.notAcceptingOwners.next',
    defaultMessage: 'Your business is already being reviewed. Nothing was changed.',
  },
  stakeExceedsTitle: { id: 'problem.code.stakeExceeds.title', defaultMessage: 'Ownership adds up to more than 100%' },
  accountRefusedTitle: {
    id: 'problem.code.accountOpeningRefused.title',
    defaultMessage: 'You cannot open an account yet',
  },
  accountRefusedNext: {
    id: 'problem.code.accountOpeningRefused.next',
    defaultMessage: 'Your identity must be verified first. Nothing was changed.',
  },
  unsupportedCurrencyTitle: {
    id: 'problem.code.unsupportedCurrency.title',
    defaultMessage: 'We do not hold this currency',
  },
  unsupportedCurrencyNext: { id: 'problem.code.unsupportedCurrency.next', defaultMessage: 'Choose another currency.' },
  notEmptyTitle: { id: 'problem.code.accountNotEmpty.title', defaultMessage: 'This account cannot be closed yet' },
  notEmptyNext: {
    id: 'problem.code.accountNotEmpty.next',
    defaultMessage: 'Move all money out and wait for payments in progress to finish, then try again.',
  },
  notActiveTitle: { id: 'problem.code.accountNotActive.title', defaultMessage: 'This account is not open' },
  notActiveNext: { id: 'problem.code.accountNotActive.next', defaultMessage: 'Nothing was changed.' },
  // Stage 4 (money movement). Risk, limit and screening refusals say nothing about why (INV-RSK-08).
  unknownSourceTitle: {
    id: 'problem.code.unknownSource.title',
    defaultMessage: 'We could not find the account to send from',
  },
  unknownSourceNext: {
    id: 'problem.code.unknownSource.next',
    defaultMessage: 'Choose one of your wallets and try again. Nothing was sent.',
  },
  unknownDestinationTitle: {
    id: 'problem.code.unknownDestination.title',
    defaultMessage: 'We could not find that account',
  },
  unknownDestinationNext: {
    id: 'problem.code.unknownDestination.next',
    defaultMessage: 'Check the account reference with the recipient. Nothing was sent.',
  },
  noWalletTitle: { id: 'problem.code.noWallet.title', defaultMessage: 'You have no wallet in this currency' },
  noWalletNext: {
    id: 'problem.code.noWallet.next',
    defaultMessage: 'Add the currency to your wallet first. Nothing was charged.',
  },
  unknownInstrumentTitle: {
    id: 'problem.code.unknownInstrument.title',
    defaultMessage: 'This card or bank account cannot be used',
  },
  unknownInstrumentNext: {
    id: 'problem.code.unknownInstrument.next',
    defaultMessage: 'Choose another one. Nothing was charged.',
  },
  currencyMismatchTitle: {
    id: 'problem.code.currencyMismatch.title',
    defaultMessage: 'This card or bank account does not take this currency',
  },
  currencyMismatchNext: {
    id: 'problem.code.currencyMismatch.next',
    defaultMessage: 'Choose another currency or payment method. Nothing was charged.',
  },
  providerUnavailableTitle: {
    id: 'problem.code.providerUnavailable.title',
    defaultMessage: 'Payments are unavailable right now',
  },
  providerUnavailableNext: {
    id: 'problem.code.providerUnavailable.next',
    defaultMessage: 'Try again later. If you were paying, check its status before trying again.',
  },
  noEligibleRailTitle: { id: 'problem.code.noEligibleRail.title', defaultMessage: 'This cannot be sent right now' },
  noEligibleRailNext: { id: 'problem.code.noEligibleRail.next', defaultMessage: 'Try again later. Nothing was sent.' },
  notConfirmableTitle: {
    id: 'problem.code.notConfirmable.title',
    defaultMessage: 'This payment can no longer be confirmed',
  },
  notConfirmableNext: {
    id: 'problem.code.notConfirmable.next',
    defaultMessage: 'Check its status. Nothing more was charged.',
  },
  notCancellableTitle: {
    id: 'problem.code.notCancellable.title',
    defaultMessage: 'This payment can no longer be cancelled',
  },
  notCancellableNext: { id: 'problem.code.notCancellable.next', defaultMessage: 'Check its status.' },
  withdrawalUnfundedTitle: {
    id: 'problem.code.withdrawalUnfunded.title',
    defaultMessage: 'There is not enough money available',
  },
  withdrawalUnfundedNext: {
    id: 'problem.code.withdrawalUnfunded.next',
    defaultMessage: 'Choose a smaller amount. Nothing was sent.',
  },
  withdrawalCurrencyTitle: {
    id: 'problem.code.withdrawalCurrency.title',
    defaultMessage: 'Your bank account does not take this currency',
  },
  withdrawalCurrencyNext: {
    id: 'problem.code.withdrawalCurrency.next',
    defaultMessage: 'Choose another currency. Nothing was sent.',
  },
  fxNotEligibleTitle: {
    id: 'problem.code.fxNotEligible.title',
    defaultMessage: 'Currency exchange is not available to you',
  },
  fxNotEligibleNext: { id: 'problem.code.fxNotEligible.next', defaultMessage: 'Nothing was exchanged.' },
  pairNotOfferedTitle: {
    id: 'problem.code.pairNotOffered.title',
    defaultMessage: 'We do not exchange between these currencies',
  },
  pairNotOfferedNext: { id: 'problem.code.pairNotOffered.next', defaultMessage: 'Choose other currencies.' },
  amountOutOfRangeTitle: {
    id: 'problem.code.amountOutOfRange.title',
    defaultMessage: 'This amount is outside what we can exchange',
  },
  amountOutOfRangeNext: {
    id: 'problem.code.amountOutOfRange.next',
    defaultMessage: 'Choose an amount within the limits shown.',
  },
  pairSuspendedTitle: { id: 'problem.code.pairSuspended.title', defaultMessage: 'This exchange is paused' },
  pairSuspendedNext: {
    id: 'problem.code.pairSuspended.next',
    defaultMessage: 'Try again later. Nothing was exchanged.',
  },
  rateUnavailableTitle: {
    id: 'problem.code.rateUnavailable.title',
    defaultMessage: 'We cannot give you a rate right now',
  },
  rateUnavailableNext: { id: 'problem.code.rateUnavailable.next', defaultMessage: 'Try again in a moment.' },
  tooManyQuotesTitle: { id: 'problem.code.tooManyQuotes.title', defaultMessage: 'You have too many open quotes' },
  tooManyQuotesNext: {
    id: 'problem.code.tooManyQuotes.next',
    defaultMessage: 'Wait for one to expire, or use one, then ask again.',
  },
  quoteNotFoundTitle: { id: 'problem.code.quoteNotFound.title', defaultMessage: 'We could not find this quote' },
  quoteNotFoundNext: { id: 'problem.code.quoteNotFound.next', defaultMessage: 'Get a new quote.' },
  quoteAcceptedTitle: { id: 'problem.code.quoteAccepted.title', defaultMessage: 'This quote has already been used' },
  quoteAcceptedNext: {
    id: 'problem.code.quoteAccepted.next',
    defaultMessage: 'Check your accounts before doing anything else.',
  },
  quoteNotAcceptableTitle: {
    id: 'problem.code.quoteNotAcceptable.title',
    defaultMessage: 'This quote can no longer be used',
  },
  quoteNotAcceptableNext: {
    id: 'problem.code.quoteNotAcceptable.next',
    defaultMessage: 'Get a new quote. Nothing was exchanged.',
  },
  sourceWalletMissingTitle: {
    id: 'problem.code.sourceWalletMissing.title',
    defaultMessage: 'You have no wallet in the currency you pay from',
  },
  sourceWalletMissingNext: {
    id: 'problem.code.sourceWalletMissing.next',
    defaultMessage: 'Add that currency first. Nothing was exchanged.',
  },
  walletNotPostableTitle: {
    id: 'problem.code.walletNotPostable.title',
    defaultMessage: 'Your wallet cannot be used right now',
  },
  walletNotPostableNext: { id: 'problem.code.walletNotPostable.next', defaultMessage: 'Nothing was moved.' },
  fxFundsTitle: { id: 'problem.code.fxFunds.title', defaultMessage: 'There is not enough money available' },
  fxFundsNext: { id: 'problem.code.fxFunds.next', defaultMessage: 'Choose a smaller amount. Nothing was moved.' },
  notPayableTitle: { id: 'problem.code.notPayable.title', defaultMessage: 'This recipient cannot be paid right now' },
  notPayableNext: { id: 'problem.code.notPayable.next', defaultMessage: 'Nothing was sent.' },
  corridorNotOfferedTitle: {
    id: 'problem.code.corridorNotOffered.title',
    defaultMessage: 'We do not send to this country in this currency',
  },
  corridorNotOfferedNext: { id: 'problem.code.corridorNotOffered.next', defaultMessage: 'Nothing was sent.' },
  corridorLimitTitle: {
    id: 'problem.code.corridorLimit.title',
    defaultMessage: 'This amount is more than we can send in one payment',
  },
  corridorLimitNext: { id: 'problem.code.corridorLimit.next', defaultMessage: 'Choose a smaller amount.' },
  screeningRequiredTitle: {
    id: 'problem.code.screeningRequired.title',
    defaultMessage: 'This quote can no longer be used',
  },
  screeningRequiredNext: {
    id: 'problem.code.screeningRequired.next',
    defaultMessage: 'Get a new quote. Nothing was sent.',
  },
  corridorUnavailableTitle: {
    id: 'problem.code.corridorUnavailable.title',
    defaultMessage: 'Sending to this country is unavailable right now',
  },
  corridorUnavailableNext: {
    id: 'problem.code.corridorUnavailable.next',
    defaultMessage: 'Try again later. Nothing was sent.',
  },
  xbRefusedTitle: { id: 'problem.code.xbRefused.title', defaultMessage: 'This payment could not be sent' },
  xbRefusedNext: { id: 'problem.code.xbRefused.next', defaultMessage: 'Nothing was taken from your wallet.' },
  xbLimitTitle: { id: 'problem.code.xbLimit.title', defaultMessage: 'This payment could not be sent' },
  xbLimitNext: { id: 'problem.code.xbLimit.next', defaultMessage: 'Nothing was taken from your wallet.' },
  xbNotCancellableTitle: {
    id: 'problem.code.xbNotCancellable.title',
    defaultMessage: 'This payment can no longer be cancelled',
  },
  xbNotCancellableNext: { id: 'problem.code.xbNotCancellable.next', defaultMessage: 'It will arrive as planned.' },
  screeningUnavailableTitle: {
    id: 'problem.code.screeningUnavailable.title',
    defaultMessage: 'We cannot quote this payment right now',
  },
  screeningUnavailableNext: { id: 'problem.code.screeningUnavailable.next', defaultMessage: 'Try again in a moment.' },
  stakeExceedsNext: {
    id: 'problem.code.stakeExceeds.next',
    defaultMessage: 'Check the shares already declared and enter a smaller one.',
  },
});

/**
 * Codes with wording of their own. Kept to codes the contract documents (ERROR_CONTRACT.md); each later
 * stage adds the codes its screens can receive.
 */
const CODE_EXPLANATIONS: ReadonlyMap<string, Explanation> = new Map([
  ['identity.AuthenticationFailed', { title: byCode.authFailedTitle, nextStep: byCode.authFailedNext }],
  ['fx.QuoteExpired', { title: byCode.quoteExpiredTitle, nextStep: byCode.quoteExpiredNext }],
  ['lending.TermsChanged', { title: byCode.termsChangedTitle, nextStep: byCode.termsChangedNext }],
  ['bnpl.TermsChanged', { title: byCode.termsChangedTitle, nextStep: byCode.termsChangedNext }],
  ['lending.ProductNotOffered', { title: byCode.productNotOfferedTitle, nextStep: byCode.productNotOfferedNext }],
  ['bnpl.ProductNotOffered', { title: byCode.productNotOfferedTitle, nextStep: byCode.productNotOfferedNext }],
  ['credit.ProductNotOffered', { title: byCode.productNotOfferedTitle, nextStep: byCode.productNotOfferedNext }],
  ['party.RegistrationRefused', { title: byCode.registrationRefusedTitle, nextStep: byCode.registrationRefusedNext }],
  ['consent.ConsentRequired', { title: byCode.consentRequiredTitle, nextStep: byCode.consentRequiredNext }],
  ['consent.ReconsentRequired', { title: byCode.reconsentTitle, nextStep: byCode.reconsentNext }],
  ['consent.UnknownTextVersion', { title: byCode.reconsentTitle, nextStep: byCode.reconsentNext }],
  ['kyc.NoOpenCase', { title: byCode.noOpenCaseTitle, nextStep: byCode.noOpenCaseNext }],
  ['kyc.OwnerNotEligible', { title: byCode.ownerNotEligibleTitle, nextStep: byCode.ownerNotEligibleNext }],
  ['kyc.OwnerAlreadyDeclared', { title: byCode.ownerDeclaredTitle, nextStep: byCode.ownerDeclaredNext }],
  ['kyc.CaseNotAcceptingOwners', { title: byCode.notAcceptingOwnersTitle, nextStep: byCode.notAcceptingOwnersNext }],
  ['kyc.StakeExceedsWhole', { title: byCode.stakeExceedsTitle, nextStep: byCode.stakeExceedsNext }],
  ['accounts.AccountOpeningRefused', { title: byCode.accountRefusedTitle, nextStep: byCode.accountRefusedNext }],
  [
    'accounts.UnsupportedCurrency',
    { title: byCode.unsupportedCurrencyTitle, nextStep: byCode.unsupportedCurrencyNext },
  ],
  ['accounts.AccountNotEmpty', { title: byCode.notEmptyTitle, nextStep: byCode.notEmptyNext }],
  ['accounts.AccountNotActive', { title: byCode.notActiveTitle, nextStep: byCode.notActiveNext }],
  ['transfers.UnknownSource', { title: byCode.unknownSourceTitle, nextStep: byCode.unknownSourceNext }],
  ['transfers.UnknownDestination', { title: byCode.unknownDestinationTitle, nextStep: byCode.unknownDestinationNext }],
  ['payments.NoWallet', { title: byCode.noWalletTitle, nextStep: byCode.noWalletNext }],
  ['payments.UnknownInstrument', { title: byCode.unknownInstrumentTitle, nextStep: byCode.unknownInstrumentNext }],
  ['payments.CurrencyMismatch', { title: byCode.currencyMismatchTitle, nextStep: byCode.currencyMismatchNext }],
  [
    'payments.ProviderUnavailable',
    { title: byCode.providerUnavailableTitle, nextStep: byCode.providerUnavailableNext },
  ],
  ['payments.NoEligibleRail', { title: byCode.noEligibleRailTitle, nextStep: byCode.noEligibleRailNext }],
  ['payments.NotConfirmable', { title: byCode.notConfirmableTitle, nextStep: byCode.notConfirmableNext }],
  ['payments.NotCancellable', { title: byCode.notCancellableTitle, nextStep: byCode.notCancellableNext }],
  ['payments.WithdrawalUnfunded', { title: byCode.withdrawalUnfundedTitle, nextStep: byCode.withdrawalUnfundedNext }],
  [
    'payments.WithdrawalCurrencyMismatched',
    { title: byCode.withdrawalCurrencyTitle, nextStep: byCode.withdrawalCurrencyNext },
  ],
  ['fx.CustomerNotEligible', { title: byCode.fxNotEligibleTitle, nextStep: byCode.fxNotEligibleNext }],
  ['fx.PairNotOffered', { title: byCode.pairNotOfferedTitle, nextStep: byCode.pairNotOfferedNext }],
  ['fx.AmountOutOfRange', { title: byCode.amountOutOfRangeTitle, nextStep: byCode.amountOutOfRangeNext }],
  ['fx.PairSuspended', { title: byCode.pairSuspendedTitle, nextStep: byCode.pairSuspendedNext }],
  ['fx.RateUnavailable', { title: byCode.rateUnavailableTitle, nextStep: byCode.rateUnavailableNext }],
  ['fx.TooManyOpenQuotes', { title: byCode.tooManyQuotesTitle, nextStep: byCode.tooManyQuotesNext }],
  ['fx.QuoteNotFound', { title: byCode.quoteNotFoundTitle, nextStep: byCode.quoteNotFoundNext }],
  ['fx.QuoteAlreadyAccepted', { title: byCode.quoteAcceptedTitle, nextStep: byCode.quoteAcceptedNext }],
  ['fx.QuoteNotAcceptable', { title: byCode.quoteNotAcceptableTitle, nextStep: byCode.quoteNotAcceptableNext }],
  ['fx.SourceWalletMissing', { title: byCode.sourceWalletMissingTitle, nextStep: byCode.sourceWalletMissingNext }],
  ['fx.WalletNotPostable', { title: byCode.walletNotPostableTitle, nextStep: byCode.walletNotPostableNext }],
  ['fx.InsufficientFunds', { title: byCode.fxFundsTitle, nextStep: byCode.fxFundsNext }],
  ['crossborder.BeneficiaryNotPayable', { title: byCode.notPayableTitle, nextStep: byCode.notPayableNext }],
  [
    'crossborder.CorridorNotOffered',
    { title: byCode.corridorNotOfferedTitle, nextStep: byCode.corridorNotOfferedNext },
  ],
  ['crossborder.AmountExceedsCorridorLimit', { title: byCode.corridorLimitTitle, nextStep: byCode.corridorLimitNext }],
  ['crossborder.ScreeningRequired', { title: byCode.screeningRequiredTitle, nextStep: byCode.screeningRequiredNext }],
  [
    'crossborder.CorridorUnavailable',
    { title: byCode.corridorUnavailableTitle, nextStep: byCode.corridorUnavailableNext },
  ],
  ['crossborder.RiskRefused', { title: byCode.xbRefusedTitle, nextStep: byCode.xbRefusedNext }],
  ['crossborder.LimitRefused', { title: byCode.xbLimitTitle, nextStep: byCode.xbLimitNext }],
  ['crossborder.NotCancellable', { title: byCode.xbNotCancellableTitle, nextStep: byCode.xbNotCancellableNext }],
  [
    'crossborder.ScreeningUnavailable',
    { title: byCode.screeningUnavailableTitle, nextStep: byCode.screeningUnavailableNext },
  ],
]);

/** The customer's explanation of any failure. A non-ApiError is a defect of this application. */
export function explain(error: unknown): Explanation {
  if (!(error instanceof ApiError)) return CATEGORY_EXPLANATIONS.defect;
  const own = error.code === undefined ? undefined : CODE_EXPLANATIONS.get(error.code);
  return own ?? CATEGORY_EXPLANATIONS[error.category];
}

/** The codes with their own wording - for the catalogue test. */
export function catalogueCodes(): readonly string[] {
  return [...CODE_EXPLANATIONS.keys()];
}
