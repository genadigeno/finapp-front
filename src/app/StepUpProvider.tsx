// One step-up dialog for the whole application (ADR-F02, ADR-F05 decision 2).
//
// `requestStepUp()` opens the dialog and resolves once finapp has accepted the code and rotated the
// session; it rejects if the customer cancels. Concurrent requests share one dialog and one outcome, so
// two refused reads never ask twice.
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StepUpDialog } from '../design-system/Dialogs.tsx';
import { useApi } from '../platform/api/api-context.tsx';
import { stepUp } from '../platform/session/auth-api.ts';
import type { RequestStepUp } from '../platform/session/step-up.ts';
import { StepUpContext } from '../platform/session/step-up-context.ts';

interface Pending {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: Error) => void;
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [opened, setOpened] = useState(false);
  const pending = useRef<Pending | undefined>(undefined);

  const requestStepUp = useCallback<RequestStepUp>(() => {
    if (pending.current !== undefined) return pending.current.promise;
    let resolve: () => void = () => undefined;
    let reject: (reason: Error) => void = () => undefined;
    const promise = new Promise<void>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    pending.current = { promise, resolve, reject };
    setOpened(true);
    return promise;
  }, []);

  const settle = (outcome: 'proved' | 'cancelled') => {
    const current = pending.current;
    pending.current = undefined;
    setOpened(false);
    if (outcome === 'proved') current?.resolve();
    else current?.reject(new Error('The customer cancelled the step-up.'));
  };

  return (
    <StepUpContext value={requestStepUp}>
      {children}
      <StepUpDialog
        opened={opened}
        onSubmit={async (code) => {
          await stepUp(api, code);
          settle('proved');
        }}
        onCancel={() => settle('cancelled')}
      />
    </StepUpContext>
  );
}
