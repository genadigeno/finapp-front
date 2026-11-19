import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodResolver } from './zod-resolver.ts';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
  nested: z.object({ code: z.string().regex(/^\d{6}$/, 'Six digits.') }),
});

const resolve = (values: unknown) =>
  zodResolver(schema)(values as z.infer<typeof schema>, undefined, { fields: {}, shouldUseNativeValidation: false });

describe('zodResolver (ADR-F03)', () => {
  it('returns the parsed values when valid', async () => {
    expect(await resolve({ name: ' Ada ', nested: { code: '123456' } })).toEqual({
      values: { name: 'Ada', nested: { code: '123456' } },
      errors: {},
    });
  });

  it('returns the first message per field, keyed by its dotted path', async () => {
    const result = await resolve({ name: '', nested: { code: '12' } });
    expect(result.values).toEqual({});
    expect(result.errors).toEqual({
      name: { type: 'too_small', message: 'Enter a name.' },
      'nested.code': { type: 'invalid_format', message: 'Six digits.' },
    });
  });
});
