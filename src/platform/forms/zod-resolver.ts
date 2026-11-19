// React Hook Form + Zod (ADR-F03), without @hookform/resolvers: its current major is days old and declares
// dozens of peer dependencies; this is the whole of what the application needs from it.
//
// Zod validates SHAPE only - required, length, charset - so the customer hears about a typo before a round
// trip. It never decides anything finapp decides (ADR-F04 decision 3, ADR-F06): finapp validates again and
// its answer is the one that counts.
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import { z } from 'zod';

// Zod 4 compiles object schemas with `new Function` when it can, and probes for it on first use. The CSP
// forbids eval and Trusted Types refuses the sink (ADR-F07): the probe fails safely, but the browser still
// reports a violation, and the catalogue's zero-violation rule fails. Jitless mode never probes.
z.config({ jitless: true });

export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (path !== '' && errors[path] === undefined) errors[path] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
