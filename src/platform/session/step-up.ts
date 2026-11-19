// Step-up by rotation, replayed once (ADR-F02, ADR-F05 decision 2). Adapted from
// finapp-admin-panel/src/platform/session/step-up.ts (ADR-F08).
//
// A read refused with `403 identity.AssuranceRequired` is retried exactly ONCE after the customer proves
// a second factor (POST /v1/authentications/mfa rotates the session). Commands use executeCommand, which
// applies the same rule with the intent's key. A second refusal is an error, never a loop; a cancelled
// prompt rethrows the original refusal.
import { ApiError } from '../api/api-error.ts';

/** Resolves once the session has been stepped up; rejects if the customer cancels. */
export type RequestStepUp = () => Promise<void>;

export async function runWithStepUp<R>(act: () => Promise<R>, requestStepUp: RequestStepUp): Promise<R> {
  try {
    return await act();
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isAssuranceRequired) throw error;
    try {
      await requestStepUp();
    } catch {
      throw error;
    }
    return act();
  }
}
