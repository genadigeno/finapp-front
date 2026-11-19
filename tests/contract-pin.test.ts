import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { pinProblems, sha256 } from '../scripts/lib/contract.mjs';

const contract = readFileSync('contract/openapi.json', 'utf8');
const source = JSON.parse(readFileSync('contract/SOURCE.json', 'utf8')) as { commit: string; sha256: string };

describe('the contract pin (ADR-F01)', () => {
  it('holds for the committed contract', () => {
    expect(pinProblems(contract, source)).toEqual([]);
  });

  it('fails when the contract is edited by hand', () => {
    expect(pinProblems(`${contract} `, source)).toHaveLength(1);
  });

  it('fails when SOURCE.json names no full commit', () => {
    expect(pinProblems(contract, { ...source, commit: 'HEAD' })).toHaveLength(1);
    expect(sha256('x')).toHaveLength(64);
  });
});

// The acceptance probe of P18-TSK-002: a contract that loses a field the application reads must fail the
// typecheck, so a backend change can never silently break a screen. Code that reads the field:
const PROBE = `
import type { components } from './finapp-api.ts';
type Profile = components['schemas']['ProfileResponse'];
export const kind = (profile: Profile): string | undefined => profile.kind;
`;

async function diagnosticsAgainst(schema: unknown): Promise<readonly ts.Diagnostic[]> {
  const dir = mkdtempSync(path.join(tmpdir(), 'contract-probe-'));
  try {
    writeFileSync(
      path.join(dir, 'finapp-api.ts'),
      astToString(await openapiTS(schema as never, { alphabetize: true, exportType: true })),
    );
    writeFileSync(path.join(dir, 'probe.ts'), PROBE);
    const program = ts.createProgram([path.join(dir, 'probe.ts')], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      types: [],
    });
    return ts.getPreEmitDiagnostics(program);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('a contract change reaches the code only as a type error (P18-TSK-002 acceptance)', () => {
  it('the probe compiles against the pinned contract', async () => {
    expect(await diagnosticsAgainst(JSON.parse(contract))).toEqual([]);
  });

  it('the probe fails to compile once the field is removed from the contract', async () => {
    const changed = JSON.parse(contract) as {
      components: { schemas: Record<string, { properties: Record<string, unknown> }> };
    };
    delete changed.components.schemas['ProfileResponse']?.properties['kind'];
    const diagnostics = await diagnosticsAgainst(changed);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(ts.flattenDiagnosticMessageText(diagnostics[0]?.messageText ?? '', '\n')).toContain("'kind'");
  });
});
