# CAVA Core

CAVA Core is the open-source skeleton for **Canonical Action Verification and Attestation**.

It gives developers a portable way to describe runtime actions, compute canonical fingerprints, and verify receipts. It does **not** ship OSuite's managed governance runtime, production parser packs, approval workflows, evidence graph, or enterprise attestation services.

## What This Package Is

Use CAVA Core when you want a neutral vocabulary and lightweight SDK for:

- defining canonical action objects;
- creating **CAVA-IR**, a portable intermediate representation for agent actions;
- hashing action semantics deterministically;
- building and verifying local receipt objects;
- using **CAVA-Verify** to bind approvals to a single semantic action;
- projecting action identity into telemetry and attestation formats;
- writing your own runtime adapter;
- defining parser packs that can decompose one runtime event into multiple canonical actions;
- using disclosure-safe reference parser packs for reproducible examples;
- experimenting with CAVA outside OSuite.

```js
import {
  buildApprovalBinding,
  buildCavaReceipt,
  canonicalizeRuntimeEvent,
  createCavaIr,
  decomposeRuntimeEvent,
  defineParserPack,
  defineRuntimeAdapter,
  getReferenceParserPacks,
  projectCavaToOpenTelemetry,
  verifyApprovalBinding,
  verifyCavaReceipt,
} from 'osuite-cava-core';

const adapter = defineRuntimeAdapter({
  id: 'example-shell-adapter',
  runtime: 'shell',
  normalize(raw) {
    return {
      runtime: 'shell',
      executable: raw.executable,
      operation: raw.operation,
      category: raw.operation === 'push' ? 'deployment' : 'observation',
      systems_touched: raw.systems || ['git'],
      reversible: raw.operation !== 'push',
    };
  },
});

const canonical = canonicalizeRuntimeEvent(
  { executable: 'git', operation: 'push', systems: ['git', 'github'] },
  { adapter }
);

const receipt = buildCavaReceipt(canonical.action, {
  decision: 'require_approval',
  policy_id: 'local-demo-policy',
});
const ir = createCavaIr(canonical.action);
const binding = buildApprovalBinding({ actionId: 'act_1', ir });

console.log(canonical.fingerprint);
console.log(verifyCavaReceipt(receipt).valid);
console.log(verifyApprovalBinding(binding, { actionId: 'act_1', ir }).valid);
console.log(projectCavaToOpenTelemetry(ir)['cava.semantic_key']);

const shellPack = defineParserPack({
  id: 'example-shell-pack',
  version: '0.1.0',
  parse(raw) {
    if (raw.command !== 'env OSUITE_POLICY=disabled npm run deploy') return [];
    return [
      {
        runtime: 'shell',
        executable: 'env',
        operation: 'governance_override',
        category: 'policy_degradation',
        systems_touched: ['osuite'],
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

const decomposed = decomposeRuntimeEvent(
  { command: 'env OSUITE_POLICY=disabled npm run deploy' },
  { parserPacks: [shellPack] }
);
console.log(decomposed.action_count);

const reference = decomposeRuntimeEvent(
  { runtime: 'mcp', tool: 'github', operation: 'push', target: 'main' },
  { parserPacks: getReferenceParserPacks() }
);
console.log(reference.primary_action.category);
```

## Framework Layers

- **CAVA-IR:** the action intermediate representation. It records actor, runtime, operation, resource, effect, authority boundary, data boundary, approval binding, and attestation references.
- **CAVA-Verify:** the verifier layer. It checks receipt integrity and rejects approval replay when the action id or semantic key changes.
- **CAVA-Decompose:** the parser-pack layer. It can split a single runtime event into multiple canonical actions, so a policy override hidden beside a deployment is not collapsed into one benign string.
- **CAVA-Bench:** the benchmark posture. The open package provides primitives that can be tested against wrapper bypass, semantic equivalence, semantic separation, receipt tampering, and projection compatibility.

## Open-Core Boundary

CAVA uses an open-core boundary: it should be open enough to become a category language, but not so complete that the open package recreates OSuite's hosted product.

Open source:

- canonical action schema;
- CAVA-IR schema and validation;
- deterministic SHA-256 hashing;
- receipt build and verify helpers;
- approval binding verification;
- OpenTelemetry-style and in-toto-style projection helpers;
- profile normalization;
- runtime adapter contract;
- parser-pack contract and decomposition result schema;
- disclosure-safe reference parser packs for MCP, browser, cloud, database, payment, and web3 examples;
- local experimentation primitives.

OSuite commercial layer:

- maintained production parser packs;
- private parser-pack update channels and customer-specific runtime enrichment;
- PCAA policy routing and risk calibration;
- approval binding workflows;
- evidence graph, replay, and buyer-ready exports;
- enterprise signer orchestration, private KMS/HSM, verifiable credentials, and optional ledger anchoring;
- managed connectors for enterprise runtimes and SaaS platforms.

Read [COMMERCIAL_BOUNDARY.md](./COMMERCIAL_BOUNDARY.md) for the full boundary.

## Design Position

CAVA should not be trapped inside OSuite. The stronger company story is:

> CAVA is the portable open semantics layer. OSuite is the managed governance system that operationalizes it.

That lets the ecosystem adopt the language while customers still pay for managed policy, runtime coverage, evidence, integrations, support, and assurance.

## Current Status

This package is intentionally a skeleton. The production-grade implementation in OSuite Studio includes richer parser packs, risk semantics, approval workflows, evidence closure, and enterprise operations that are not exported here.
