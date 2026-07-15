import { CAVA_RECEIPT_SCHEMA_VERSION, createCanonicalAction } from './schema.js';
import { hashCanonicalValue } from './hash.js';
import { normalizeCavaProfile } from './profile.js';

export function buildCavaReceipt(input = {}, options = {}) {
  const canonicalAction = createCanonicalAction(input.canonical_action || input.action || input);
  const profile = normalizeCavaProfile(options.profile || input.profile || {});
  const payload = {
    schema_version: CAVA_RECEIPT_SCHEMA_VERSION,
    canonical_fingerprint: input.canonical_fingerprint || hashCanonicalValue(canonicalAction),
    canonical_action: canonicalAction,
    profile: {
      schema_version: profile.schema_version,
      id: profile.id,
      mode: profile.mode,
    },
    decision: options.decision || input.decision || null,
    policy_id: options.policy_id || input.policy_id || null,
    attestation_ref: options.attestation_ref || input.attestation_ref || null,
  };

  return {
    ...payload,
    receipt_hash: hashCanonicalValue(payload),
  };
}

export function verifyCavaReceipt(receipt = {}) {
  const { receipt_hash: receiptHash, ...payload } = receipt;
  if (!receiptHash) {
    return { valid: false, reason: 'missing_receipt_hash' };
  }
  const expected = hashCanonicalValue(payload);
  return {
    valid: expected === receiptHash,
    expected,
    actual: receiptHash,
  };
}
