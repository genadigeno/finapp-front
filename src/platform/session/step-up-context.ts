// The step-up request, reachable from any module (ADR-F02, ADR-F05 decision 2). The application's
// StepUpProvider (src/app) supplies it, with the dialog; modules only ever ask for it.
import { createContext, use } from 'react';
import type { RequestStepUp } from './step-up.ts';

export const StepUpContext = createContext<RequestStepUp | undefined>(undefined);

export function useStepUp(): RequestStepUp {
  const request = use(StepUpContext);
  if (request === undefined) throw new Error('useStepUp() needs a <StepUpProvider>.');
  return request;
}
