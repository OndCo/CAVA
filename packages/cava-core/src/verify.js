import { createCavaIr } from './ir.js';
import { hashCanonicalValue } from './hash.js';
import { verifyCavaReceipt } from './receipt.js';

function normalizeString(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeIr(value) {
  return value?.semantic_key ? value : createCavaIr(value || {});
}

function bindingPayload(binding = {}) {
  const { binding_hash: ignored, ...payload } = binding;
  return payload;
}

export function buildApprovalBinding({
  actionId,
  ir,
  approverId = 'unknown',
  policyId = null,
  decidedAt = new Date().toISOString(),
} = {}) {
  const normalizedIr = normalizeIr(ir);
  const normalizedActionId = normalizeString(actionId, 'action');
  const payload = {
    schema_version: 'osuite.cava.approval_binding.v1',
    action_id: normalizedActionId,
    semantic_key: normalizedIr.semantic_key,
    approver_id: normalizeString(approverId, 'unknown'),
    policy_id: normalizeString(policyId, null),
    decided_at: normalizeString(decidedAt, new Date().toISOString()),
    binding_mode: 'canonical_fingerprint',
    scope: {
      kind: 'single_action',
      action_id: normalizedActionId,
      semantic_key: normalizedIr.semantic_key,
      reusable: false,
    },
  };

  return {
    ...payload,
    binding_hash: hashCanonicalValue(payload),
  };
}

export function verifyApprovalBinding(binding = {}, { actionId, ir } = {}) {
  if (!binding || typeof binding !== 'object') return { valid: false, reason: 'missing_binding' };
  const expectedHash = hashCanonicalValue(bindingPayload(binding));
  if (binding.binding_hash && binding.binding_hash !== expectedHash) {
    return { valid: false, reason: 'binding_hash_mismatch', expected: expectedHash, actual: binding.binding_hash };
  }
  const normalizedActionId = normalizeString(actionId, null);
  const scopeActionId = normalizeString(binding.scope?.action_id || binding.action_id, null);
  if (normalizedActionId && scopeActionId && normalizedActionId !== scopeActionId) {
    return { valid: false, reason: 'action_id_mismatch' };
  }
  const normalizedIr = ir ? normalizeIr(ir) : null;
  const expectedSemanticKey = normalizeString(normalizedIr?.semantic_key, null);
  const bindingSemanticKey = normalizeString(binding.scope?.semantic_key || binding.semantic_key, null);
  if (expectedSemanticKey && bindingSemanticKey && expectedSemanticKey !== bindingSemanticKey) {
    return { valid: false, reason: 'semantic_key_mismatch' };
  }
  if (binding.scope?.reusable === true) {
    return { valid: false, reason: 'reusable_scope_not_allowed' };
  }
  return { valid: true, reason: 'binding_satisfied' };
}

export function verifyCavaExecution({
  ir,
  actionId,
  approvalBinding = null,
  receipt = null,
} = {}) {
  const checks = [];
  if (approvalBinding) {
    checks.push({ check: 'approval_binding', ...verifyApprovalBinding(approvalBinding, { actionId, ir }) });
  }
  if (receipt) {
    checks.push({ check: 'receipt_integrity', ...verifyCavaReceipt(receipt) });
  }
  const failed = checks.find((check) => check.valid === false);
  return {
    valid: !failed,
    reason: failed?.reason || 'execution_verified',
    checks,
  };
}
