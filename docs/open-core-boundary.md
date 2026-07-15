# Open-Core Boundary

CAVA's open layer is designed for interoperability. It should let developers
describe, hash, verify, and exchange governed action objects without requiring
OSuite Studio.

The hosted OSuite product remains responsible for managed policy, runtime
coverage, approval workflows, evidence replay, external verifier orchestration,
and customer-facing operational assurance.

## Open-source layer

```text
runtime event
  -> canonical action
  -> CAVA-IR
  -> semantic fingerprint
  -> local receipt
  -> verifier result
```

## Managed OSuite layer

```text
runtime adapters
  -> CAVA production packs
  -> PCAA authority
  -> Decision Score
  -> BAF action lease
  -> AREG exposure graph
  -> replayable proof and assurance export
```

This split is intentional. The open framework creates a shared vocabulary. The
managed product makes that vocabulary operational for enterprise teams.
