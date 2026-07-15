import { createCanonicalAction, validateCanonicalAction } from './schema.js';
import { hashCanonicalValue } from './hash.js';
import { normalizeCavaProfile } from './profile.js';

export function defineRuntimeAdapter(adapter = {}) {
  if (typeof adapter.normalize !== 'function') {
    throw new TypeError('CAVA runtime adapters must provide normalize(rawEvent, context).');
  }
  return {
    id: String(adapter.id || 'anonymous-adapter'),
    runtime: String(adapter.runtime || 'unknown'),
    normalize: adapter.normalize,
  };
}

export function canonicalizeRuntimeEvent(rawEvent = {}, options = {}) {
  const profile = normalizeCavaProfile(options.profile || {});
  const normalized = options.adapter
    ? options.adapter.normalize(rawEvent, { profile })
    : rawEvent;
  const action = createCanonicalAction(normalized);
  const validation = validateCanonicalAction(action);
  const fingerprint = hashCanonicalValue(action);
  const riskScore = profile.category_risk[action.category] ?? profile.category_risk.unknown;

  return {
    action,
    fingerprint,
    profile: {
      schema_version: profile.schema_version,
      id: profile.id,
      mode: profile.mode,
    },
    risk_score: riskScore,
    validation,
  };
}
