import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Lint as a control (P18-TSK-008): these lint snippets with the REAL eslint.config.js, so a rule that is
// weakened or removed turns them red - each guard is demonstrated, not assumed. Adapted from
// finapp-admin-panel/tests/eslint-guards.test.ts (ADR-F08).
const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse');
}

describe('money never becomes a JavaScript number (ADR-F04 decision 7)', () => {
  it.each([
    ['parseFloat', 'export const f = (s: string) => parseFloat(s);'],
    ['Number.parseFloat', 'export const f = (s: string) => Number.parseFloat(s);'],
    ['Number(x.amount)', 'export const f = (x: { amount: string }) => Number(x.amount);'],
    ['Number(amount)', 'export const f = (amount: string) => Number(amount);'],
    ['Number(balance.available)', 'export const f = (b: { availableBalance: string }) => Number(b.availableBalance);'],
    ['Number(fee)', 'export const f = (fee: string) => Number(fee);'],
    ['Number(q.rate)', 'export const f = (q: { rate: string }) => Number(q.rate);'],
    ['+x.amount', 'export const f = (x: { amount: string }) => +x.amount;'],
    ['+netAmount', 'export const f = (netAmount: string) => +netAmount;'],
    ['+exchangeRate', 'export const f = (exchangeRate: string) => +exchangeRate;'],
    ['toFixed', 'export const f = (n: number) => n.toFixed(2);'],
  ])('flags %s', async (_label, code) => {
    expect(await ruleIds(code, 'src/money.ts')).toContain('no-restricted-syntax');
  });

  it.each([
    ['a count', 'export const f = (count: string) => Number(count);'],
    [
      'a word that merely contains "rate"',
      'export const f = (generated: string, accurate: string) => [Number(generated), Number(accurate)];',
    ],
  ])('does not flag %s', async (_label, code) => {
    expect(await ruleIds(code, 'src/count.ts')).toEqual([]);
  });
});

describe('script-injection paths are banned (ADR-F07 decision 2)', () => {
  it('flags dangerouslySetInnerHTML', async () => {
    const code = 'export const C = (p: { h: string }) => <div dangerouslySetInnerHTML={{ __html: p.h }} />;';
    expect(await ruleIds(code, 'src/c.tsx')).toContain('no-restricted-syntax');
  });

  it('flags innerHTML assignment and insertAdjacentHTML', async () => {
    expect(
      await ruleIds('export const f = (e: HTMLElement, s: string) => { e.innerHTML = s; };', 'src/e.ts'),
    ).toContain('no-restricted-syntax');
    expect(
      await ruleIds(
        "export const f = (e: HTMLElement, s: string) => e.insertAdjacentHTML('beforeend', s);",
        'src/e.ts',
      ),
    ).toContain('no-restricted-syntax');
  });

  it('flags eval, new Function and a string timer', async () => {
    const ids = await ruleIds(
      "export const f = (s: string) => [eval(s), new Function(s), setTimeout('alert(1)', 1)];",
      'src/e.ts',
    );
    expect(ids).toEqual(expect.arrayContaining(['no-eval', 'no-new-func', 'no-restricted-syntax']));
  });
});

describe('nothing is stored at rest in the browser (ADR-F07 decision 4)', () => {
  it.each([
    ['localStorage', "export const f = () => localStorage.getItem('x');"],
    ['window.localStorage', "export const f = () => window.localStorage.getItem('x');"],
    ['sessionStorage', "export const f = () => sessionStorage.setItem('x', 'y');"],
    ['indexedDB', "export const f = () => indexedDB.open('x');"],
    ['document.cookie', 'export const f = () => document.cookie;'],
  ])('flags %s in product code', async (_label, code) => {
    const ids = await ruleIds(code, 'src/modules/accounts/store.ts');
    expect(ids.some((id) => id === 'no-restricted-globals' || id === 'no-restricted-properties')).toBe(true);
  });

  it('allows localStorage in the preferences module alone - and still not sessionStorage there', async () => {
    expect(await ruleIds("export const f = () => localStorage.getItem('x');", 'src/platform/preferences.ts')).toEqual(
      [],
    );
    expect(
      await ruleIds("export const f = () => sessionStorage.getItem('x');", 'src/platform/preferences.ts'),
    ).toContain('no-restricted-globals');
  });
});

describe('the CSP is not undermined by components that inject <style> (ADR-F07)', () => {
  it.each(['Modal', 'Drawer', 'AppShell', 'SimpleGrid'])('flags importing %s from Mantine', async (name) => {
    const code = `import { ${name} } from '@mantine/core';\nexport const C = ${name};`;
    expect(await ruleIds(code, 'src/modules/accounts/x.tsx')).toContain('no-restricted-imports');
  });

  it('flags useMantineColorScheme() without keepTransitions', async () => {
    const code =
      "import { useMantineColorScheme } from '@mantine/core';\nexport const f = () => useMantineColorScheme();";
    expect(await ruleIds(code, 'src/app/x.ts')).toContain('no-restricted-syntax');
  });
});

describe('test doubles never ship (DOD-CUST)', () => {
  it('flags an MSW import in product code', async () => {
    expect(await ruleIds("import { http } from 'msw';\nexport const h = http;", 'src/api.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('allows MSW in a test file', async () => {
    expect(await ruleIds("import { http } from 'msw';\nexport const h = http;", 'src/api.test.ts')).not.toContain(
      'no-restricted-imports',
    );
  });
});

describe('customer modules are isolated (blueprint §9)', () => {
  it('flags one module importing another', async () => {
    const ids = await ruleIds(
      "import { x } from '../credit/loans.ts';\nexport const y = x;",
      'src/modules/accounts/list.ts',
    );
    expect(ids).toContain('finapp/module-boundaries');
  });

  it('flags a deeper relative path and a dynamic import into another module', async () => {
    expect(
      await ruleIds(
        "import { x } from '../../modules/credit/loans.ts';\nexport const y = x;",
        'src/modules/accounts/views/list.ts',
      ),
    ).toContain('finapp/module-boundaries');
    expect(
      await ruleIds("export const page = () => import('../credit/Page.tsx');", 'src/modules/accounts/routes.ts'),
    ).toContain('finapp/module-boundaries');
  });

  it('allows a module to import the platform layer and itself', async () => {
    const code =
      "import { a } from '../../platform/api/index.ts';\nimport { b } from './util.ts';\nexport const y = [a, b];";
    expect(await ruleIds(code, 'src/modules/accounts/list.ts')).not.toContain('finapp/module-boundaries');
  });
});
