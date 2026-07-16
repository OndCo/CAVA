# CAVA

**Canonical Action Verification and Attestation for AI agent runtimes.**

[![arXiv](https://img.shields.io/badge/arXiv-2607.13716-b31b1b.svg)](https://arxiv.org/abs/2607.13716)
[![npm](https://img.shields.io/npm/v/osuite-cava-core.svg)](https://www.npmjs.com/package/osuite-cava-core)
[![License](https://img.shields.io/badge/license-Apache--2.0-black.svg)](./LICENSE)

CAVA is an open semantics layer for describing, fingerprinting, and verifying
AI-agent actions before they become operational consequences. It gives agent
builders a portable way to turn heterogeneous runtime events into canonical
action objects, bind approvals to those objects, and produce local receipts that
can be recomputed later.

This repository contains the open-core CAVA framework. It is intentionally
smaller than OSuite Studio.

## Why CAVA exists

Agent runtimes do not agree on what an action is.

A single operational act may appear as a shell command, SDK tool call, browser
automation event, MCP tool invocation, workflow step, or managed-agent trace. If
governance binds only to raw text or a runtime-native log, approval can drift:
the displayed request is not always the action that eventually executes.

CAVA makes the action itself the governance object:

```text
raw runtime event -> canonical action -> semantic fingerprint -> receipt -> verifier
```

## What is included

- Canonical action schema.
- CAVA-IR, a portable intermediate representation for governed agent actions.
- Deterministic SHA-256 semantic hashing.
- Local receipt construction and verification.
- Approval binding verification.
- Runtime adapter contract.
- Parser-pack contract and decomposition result schema.
- Disclosure-safe reference parser packs.
- OpenTelemetry-style and in-toto-style projection helpers.
- Small examples and tests.

## What is not included

This repository does **not** include OSuite Studio's managed governance product:

- production parser packs;
- customer-specific runtime enrichment;
- PCAA policy routing and authority workflows;
- Decision Score calibration;
- BAF action leases;
- AREG runtime exposure graph;
- managed evidence replay, exports, or buyer assurance;
- enterprise signers, KMS/HSM, verifiable credential issuance, or ledger anchoring;
- hosted connectors for enterprise SaaS, cloud, or managed agent platforms.

In short:

> CAVA is the open canonical action layer. OSuite is the managed governance
> control plane that operationalizes it in production.

## Install

```bash
npm install osuite-cava-core
```

For local development from this repository:

```bash
npm install
npm test
```

## Quick example

```js
import {
  buildApprovalBinding,
  buildCavaReceipt,
  canonicalizeRuntimeEvent,
  createCavaIr,
  defineRuntimeAdapter,
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

const ir = createCavaIr(canonical.action);
const receipt = buildCavaReceipt(canonical.action, {
  decision: 'require_approval',
  policy_id: 'local-demo-policy',
});
const binding = buildApprovalBinding({ actionId: 'act_1', ir });

console.log(canonical.fingerprint);
console.log(verifyCavaReceipt(receipt).valid);
console.log(verifyApprovalBinding(binding, { actionId: 'act_1', ir }).valid);
```

Runnable examples live in [`examples`](./examples).

## Repository structure

```text
packages/cava-core/      Open JavaScript package
examples/                Minimal runnable examples
tests/                   Vitest coverage for core behavior and open-core boundary
paper/                   CAVA research manuscript source
docs/                    Project notes and commercial boundary
```

## Research

The CAVA manuscript is available on arXiv:

> Zexun Wang. **CAVA: Canonical Action Verification and Attestation for Runtime
> Governance of Agentic AI Systems.** arXiv:2607.13716, 2026.

```bibtex
@misc{wang2026cava,
  title={CAVA: Canonical Action Verification and Attestation for Runtime Governance of Agentic AI Systems},
  author={Wang, Zexun},
  year={2026},
  eprint={2607.13716},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  url={https://arxiv.org/abs/2607.13716}
}
```

The LaTeX source used for the public manuscript is available in [`paper`](./paper).

## License

Apache-2.0. See [`LICENSE`](./LICENSE).
