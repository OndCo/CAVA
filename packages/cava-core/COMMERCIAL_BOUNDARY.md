# CAVA Open-Core Boundary

CAVA should be open enough to become a category language, but not so complete that the open package reproduces OSuite's hosted governance advantage.

## Free and open

The open package is the interoperability skeleton:

- canonical action schema;
- CAVA-IR schema and validation;
- deterministic hashing;
- receipt construction and verification;
- approval binding verification;
- OpenTelemetry-style and in-toto-style projection helpers;
- runtime adapter contract;
- parser-pack contract and decomposition result schema;
- disclosure-safe reference parser packs;
- profile normalization;
- reference examples for local experimentation.

This lets developers describe, hash, and verify runtime action objects without adopting OSuite.

Reference parser packs are examples, not the hosted product. They are intentionally small, structured-event packs for reproducibility and teaching.

## Not included in the open package

The open package intentionally does not include:

- OSuite's production parser packs for shell, browser, MCP, SDK, cloud, payment, identity, database, and deployment runtimes;
- private multi-action decomposition heuristics, attack-case corpora, and managed parser-pack update channels;
- PCAA policy routing, risk calibration, or approval workflow execution;
- managed evidence graph, replay UI, buyer exports, and assurance packets;
- hosted workspace governance, team roles, billing, tenant isolation, or audit operations;
- enterprise signer orchestration, private KMS/HSM integration, ledger anchoring, or verifiable credential issuance;
- managed connectors for Azure AI Foundry, Microsoft 365, Codex, Claude, OpenAI Agents SDK, LangGraph, Dify, n8n, and enterprise platforms.

## Commercial gates

OSuite should monetize the parts that turn CAVA from a schema into a governed operating system:

- **CAVA Runtime Packs:** maintained parser packs and semantic classifiers for real enterprise runtimes.
- **CAVA Decomposition Engine:** production-grade multi-action splitting for compound agent events such as policy weakening plus deployment, identity change plus data export, or evidence degradation plus destructive action.
- **CAVA Approval Binding:** approval workflows bound to canonical fingerprints with replayable closure.
- **CAVA Evidence Graph:** hosted proof, replay, exports, and buyer-facing assurance.
- **CAVA Enterprise Attestation:** private signers, KMS/HSM, W3C Verifiable Credentials, Sigstore/in-toto style supply-chain evidence, and optional public-chain anchoring.
- **CAVA Managed Compliance:** mappings to customer policies, regulated workflows, and procurement evidence.

## Positioning

CAVA should not be trapped inside OSuite. The market story is stronger if CAVA is a portable open standard and OSuite is the best managed implementation.

That gives the company two advantages at the same time:

- open-source credibility and ecosystem adoption;
- paid product value where customers need uptime, policy, evidence, integrations, and accountable governance.
