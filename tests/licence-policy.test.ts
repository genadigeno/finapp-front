import { describe, expect, it } from 'vitest';
import { satisfies, SHIPPED_ALLOWED, violations } from '../scripts/lib/licence-policy.mjs';

const pkg = (name: string, license: unknown, dev: boolean) => ({ name, version: '1.0.0', license, dev });

describe('licence policy (ADR-F03)', () => {
  it('passes the licences ADR-F03 names in the shipped bundle', () => {
    expect(violations([pkg('a', 'MIT', false), pkg('b', 'Apache-2.0', false), pkg('c', 'ISC', false)])).toEqual([]);
  });

  it('fails a GPL package that would ship - the acceptance probe', () => {
    expect(violations([pkg('copyleft', 'GPL-3.0-only', false)])).toEqual([
      { name: 'copyleft', version: '1.0.0', license: 'GPL-3.0-only', scope: 'shipped' },
    ]);
  });

  it('fails a GPL package even in development tooling', () => {
    expect(violations([pkg('copyleft-tool', 'GPL-2.0-or-later', true)])).toHaveLength(1);
  });

  it('fails a package with no licence at all', () => {
    expect(violations([pkg('mystery', undefined, false)])[0]?.license).toBe('(none)');
  });

  it('keeps tooling-only licences out of the shipped bundle', () => {
    expect(violations([pkg('creative', 'CC-BY-4.0', true)])).toEqual([]);
    expect(violations([pkg('creative', 'CC-BY-4.0', false)])).toHaveLength(1);
  });

  it('ships 0BSD (tslib), keeps MIT-0 to tooling, and excepts axe-core in tooling only', () => {
    expect(violations([pkg('tslib', '0BSD', false)])).toEqual([]);
    expect(violations([pkg('@csstools/color-helpers', 'MIT-0', true)])).toEqual([]);
    expect(violations([pkg('@csstools/color-helpers', 'MIT-0', false)])).toHaveLength(1);
    expect(violations([pkg('axe-core', 'MPL-2.0', true), pkg('@axe-core/playwright', 'MPL-2.0', true)])).toEqual([]);
    expect(violations([pkg('axe-core', 'MPL-2.0', false)])).toHaveLength(1);
  });

  it('ships isbot under its named Unlicense exception, and no other Unlicense package', () => {
    expect(violations([pkg('isbot', 'Unlicense', false)])).toEqual([]);
    expect(violations([pkg('another-unlicense-lib', 'Unlicense', false)])).toHaveLength(1);
    expect(violations([pkg('isbot', 'GPL-3.0-only', false)])).toHaveLength(1);
  });

  it('honours the named lightningcss exception in tooling only, and for no other MPL package', () => {
    expect(violations([pkg('lightningcss', 'MPL-2.0', true)])).toEqual([]);
    expect(violations([pkg('lightningcss-win32-x64-msvc', 'MPL-2.0', true)])).toEqual([]);
    expect(violations([pkg('lightningcss', 'MPL-2.0', false)])).toHaveLength(1);
    expect(violations([pkg('another-mpl-tool', 'MPL-2.0', true)])).toHaveLength(1);
  });

  it('reads SPDX expressions: OR needs one side, AND needs both', () => {
    expect(satisfies('(MIT OR GPL-3.0-only)', SHIPPED_ALLOWED)).toBe(true);
    expect(satisfies('MIT AND GPL-3.0-only', SHIPPED_ALLOWED)).toBe(false);
    expect(satisfies('(Apache-2.0 AND (MIT OR BSD-3-Clause))', SHIPPED_ALLOWED)).toBe(true);
    expect(satisfies('Apache-2.0 WITH LLVM-exception', SHIPPED_ALLOWED)).toBe(true);
  });

  it('reads legacy object and array licence fields', () => {
    expect(violations([pkg('legacy', { type: 'MIT' }, false)])).toEqual([]);
    expect(violations([pkg('legacy-array', [{ type: 'GPL-2.0' }, { type: 'MIT' }], false)])).toEqual([]);
  });
});
