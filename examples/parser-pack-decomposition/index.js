import {
  decomposeRuntimeEvent,
  defineParserPack,
} from '../../packages/cava-core/src/index.js';

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
        systems_touched: ['policy'],
        reversible: false,
      },
      {
        runtime: 'shell',
        executable: 'npm',
        operation: 'run deploy',
        category: 'deployment',
        systems_touched: ['node', 'deployment'],
        reversible: false,
      },
    ];
  },
});

const decomposition = decomposeRuntimeEvent(
  { command: 'env OSUITE_POLICY=disabled npm run deploy' },
  { parserPacks: [shellPack] }
);

console.log(JSON.stringify({
  actionCount: decomposition.action_count,
  categories: decomposition.actions.map((action) => action.category),
  primaryFingerprint: decomposition.primary_fingerprint,
}, null, 2));
