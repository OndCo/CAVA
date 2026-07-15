# Contributing

Thanks for your interest in CAVA.

This repository is intended to define a small, portable action-governance layer.
Good contributions usually improve schemas, verification primitives, examples,
documentation, or disclosure-safe reference parser packs.

## Development

```bash
npm install
npm run verify
```

`npm run verify` runs:

- the open-core boundary check;
- the Vitest suite;
- an npm package dry run for `osuite-cava-core`.

## Contribution boundary

Please keep contributions inside the open CAVA layer. Do not submit customer
secrets, proprietary parser packs, private runtime traces, or OSuite Studio
implementation details.

Before proposing a large parser pack or a new integration, open an issue that
explains:

- the runtime event shape;
- the governance action it should canonicalize;
- the fields required for deterministic replay;
- what can safely be disclosed in a public reference implementation.

## Pull request checklist

- Run `npm run verify`.
- Keep examples runnable without API keys.
- Avoid product-specific claims that are not implemented in this repository.
- Update README or docs when adding a public API.
