import {
  buildApprovalBinding,
  buildCavaReceipt,
  canonicalizeRuntimeEvent,
  createCavaIr,
  defineRuntimeAdapter,
  verifyApprovalBinding,
  verifyCavaReceipt,
} from '../../packages/cava-core/src/index.js';

const shellAdapter = defineRuntimeAdapter({
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
      target: raw.target,
    };
  },
});

const canonical = canonicalizeRuntimeEvent(
  {
    executable: 'git',
    operation: 'push',
    systems: ['git', 'github'],
    target: 'origin/main',
  },
  { adapter: shellAdapter }
);

const ir = createCavaIr(canonical.action);
const receipt = buildCavaReceipt(canonical.action, {
  decision: 'require_approval',
  policy_id: 'demo:deployment-review',
});
const binding = buildApprovalBinding({
  actionId: 'act_demo_1',
  ir,
  approverId: 'operator_demo',
  policyId: 'demo:deployment-review',
});

console.log(JSON.stringify({
  fingerprint: canonical.fingerprint,
  receiptValid: verifyCavaReceipt(receipt).valid,
  approvalBindingValid: verifyApprovalBinding(binding, {
    actionId: 'act_demo_1',
    ir,
  }).valid,
}, null, 2));
