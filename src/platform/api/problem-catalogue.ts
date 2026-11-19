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
