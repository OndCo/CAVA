export const CAVA_CANONICAL_SCHEMA_VERSION = 'cava.canonical_action.v1';
export const CAVA_RECEIPT_SCHEMA_VERSION = 'cava.receipt.v1';
export const CAVA_PROFILE_SCHEMA_VERSION = 'cava.profile.v1';

export const CAVA_REQUIRED_ACTION_FIELDS = [
  'runtime',
  'operation',
  'category',
  'systems_touched',
  'reversible',
];

export function createCanonicalAction(input = {}) {
  const systemsTouched = Array.isArray(input.systems_touched)
    ? input.systems_touched.filter(Boolean).map(String)
    : [];

  return {
    schema_version: CAVA_CANONICAL_SCHEMA_VERSION,
    runtime: String(input.runtime || input.runtime_family || 'unknown'),
    adapter: input.adapter ? String(input.adapter) : null,
    executable: input.executable ? String(input.executable) : null,
    operation: String(input.operation || 'unknown'),
    category: String(input.category || 'unknown'),
    systems_touched: systemsTouched,
    reversible: input.reversible === true,
    target: input.target ? String(input.target) : null,
    subject: input.subject ? String(input.subject) : null,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
  };
}

export function validateCanonicalAction(action = {}) {
  const missing = CAVA_REQUIRED_ACTION_FIELDS.filter((field) => action[field] == null);
  if (!Array.isArray(action.systems_touched)) missing.push('systems_touched[]');
  return {
    valid: missing.length === 0,
    missing,
    schema_version: action.schema_version || null,
  };
}
