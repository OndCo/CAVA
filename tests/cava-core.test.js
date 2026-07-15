import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildApprovalBinding,
  buildCavaInTotoStatement,
  buildCavaReceipt,
  canonicalizeRuntimeEvent,
  createCavaIr,
  decomposeRuntimeEvent,
  defineParserPack,
  defineRuntimeAdapter,
  projectCavaToOpenTelemetry,
  sha256Hex,
  verifyApprovalBinding,
  verifyCavaExecution,
  verifyCavaReceipt,
} from '../packages/cava-core/src/index.js';

describe('CAVA open-core package', () => {
  it('keeps the open package independent from OSuite Studio internals', () => {
    const packageDir = path.resolve(process.cwd(), 'packages/cava-core/src');
    const source = fs.readdirSync(packageDir)
      .filter((file) => file.endsWith('.js'))
      .map((file) => fs.readFileSync(path.join(packageDir, file), 'utf8'))
      .join('\n');

    expect(source).not.toContain('../../../app/lib/cava');
    expect(source).not.toContain('../../app/lib/cava');
    expect(source).not.toContain('Decision Score');
    expect(source).not.toContain('Bounded Action Firewall');
    expect(source).not.toContain('Agent Runtime Exposure Graph');
  });

  it('canonicalizes runtime events, hashes action meaning, and verifies receipts', () => {
    const adapter = defineRuntimeAdapter({
      id: 'unit-shell',
      runtime: 'shell',
      normalize(raw) {
        return {
          runtime: 'shell',
          executable: raw.executable,
          operation: raw.operation,
          category: raw.operation === 'push' ? 'deployment' : 'observation',
          systems_touched: ['git', 'github'],
          reversible: raw.operation !== 'push',
          target: raw.target,
        };
      },
    });

    const canonical = canonicalizeRuntimeEvent(
      { executable: 'git', operation: 'push', target: 'origin/main' },
      { adapter }
    );
    const receipt = buildCavaReceipt(canonical.action, {
      decision: 'require_approval',
      policy_id: 'unit-policy',
    });

    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(canonical.action).toMatchObject({
      runtime: 'shell',
      executable: 'git',
      operation: 'push',
      category: 'deployment',
      reversible: false,
      target: 'origin/main',
    });
    expect(canonical.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyCavaReceipt(receipt)).toMatchObject({ valid: true });
  });

  it('binds approval to one action id and semantic key', () => {
    const ir = createCavaIr({
      actor: { id: 'agent_1', type: 'agent' },
      runtime: { family: 'tool_hook_runtime', adapter: 'shell_hook' },
      operation: { verb: 'push', category: 'deployment', executable: 'git' },
      resource: { system: 'git', target: 'origin', subject: 'main' },
      effect: { reversible: false },
    });
    const changedBranch = createCavaIr({
      actor: { id: 'agent_1', type: 'agent' },
      runtime: { family: 'tool_hook_runtime', adapter: 'shell_hook' },
      operation: { verb: 'push', category: 'deployment', executable: 'git' },
      resource: { system: 'git', target: 'origin', subject: 'release' },
      effect: { reversible: false },
    });
    const binding = buildApprovalBinding({
      actionId: 'act_1',
      ir,
      approverId: 'operator_1',
      policyId: 'pol_deploy',
    });

    expect(verifyApprovalBinding(binding, { actionId: 'act_1', ir })).toMatchObject({ valid: true });
    expect(verifyApprovalBinding(binding, { actionId: 'act_2', ir })).toMatchObject({
      valid: false,
      reason: 'action_id_mismatch',
    });
    expect(verifyApprovalBinding(binding, { actionId: 'act_1', ir: changedBranch })).toMatchObject({
      valid: false,
      reason: 'semantic_key_mismatch',
    });
  });

  it('projects CAVA IR into telemetry and attestation formats', () => {
    const ir = createCavaIr({
      actor: { id: 'agent_1', type: 'agent', tenant_id: 'org_1' },
      runtime: { family: 'mcp_tool', adapter: 'github_mcp', session_id: 'sess_1' },
      operation: { verb: 'push', category: 'deployment', executable: 'git' },
      resource: { system: 'git', target: 'origin', subject: 'main' },
      effect: { reversible: false, impact: 'external_side_effect' },
      authority_boundary: { final_authority: 'pcaa', policy_id: 'pol_deploy' },
    });
    const telemetry = projectCavaToOpenTelemetry(ir);
    const statement = buildCavaInTotoStatement(ir, {
      subjectName: 'act_1',
      predicateType: 'https://osuite.ai/cava/ir/v1',
    });

    expect(telemetry).toMatchObject({
      'cava.schema_version': 'osuite.cava.ir.v1',
      'cava.semantic_key': ir.semantic_key,
      'cava.operation.category': 'deployment',
      'cava.resource.system': 'git',
      'cava.authority.final': 'pcaa',
    });
    expect(statement).toMatchObject({
      _type: 'https://in-toto.io/Statement/v1',
      predicateType: 'https://osuite.ai/cava/ir/v1',
      subject: [{ name: 'act_1', digest: { sha256: ir.semantic_key } }],
    });
    expect(verifyCavaExecution({
      ir,
      approvalBinding: buildApprovalBinding({ actionId: 'act_1', ir }),
      actionId: 'act_1',
    })).toMatchObject({ valid: true });
  });

  it('decomposes one runtime event into multiple canonical actions', () => {
    const shellPack = defineParserPack({
      id: 'unit-shell-pack',
      version: '0.1.0',
      parse(rawEvent) {
        if (rawEvent.command !== 'env OSUITE_POLICY=disabled npm run deploy') return [];
        return [
          {
            runtime: 'shell',
            executable: 'env',
            operation: 'governance_override',
            category: 'policy_degradation',
            systems_touched: ['policy'],
            reversible: false,
          },
          {
            runtime: 'shell',
            executable: 'npm',
            operation: 'run deploy',
            category: 'deployment',
            systems_touched: ['node'],
            reversible: false,
          },
        ];
      },
    });

    const result = decomposeRuntimeEvent(
      { command: 'env OSUITE_POLICY=disabled npm run deploy' },
      { parserPacks: [shellPack] }
    );

    expect(result).toMatchObject({
      schema_version: 'osuite.cava.decomposition.v1',
      action_count: 2,
      parser_pack_ids: ['unit-shell-pack@0.1.0'],
    });
    expect(result.actions.map((action) => action.category)).toEqual([
      'policy_degradation',
      'deployment',
    ]);
    expect(result.primary_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
