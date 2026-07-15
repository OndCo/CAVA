import { hashCanonicalValue } from './hash.js';

export const CAVA_IR_SCHEMA_VERSION = 'osuite.cava.ir.v1';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asStringArray(value = []) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : [];
}

function normalizeActor(input = {}) {
  const actor = asObject(input.actor);
  return {
    id: asString(actor.id || input.actor_id || input.agent_id || input.requested_by, 'unknown'),
    type: asString(actor.type || input.actor_type, input.agent_id ? 'agent' : 'unknown'),
    tenant_id: asString(actor.tenant_id || input.tenant_id || input.org_id, null),
  };
}

function normalizeRuntime(input = {}) {
  const runtime = asObject(input.runtime);
  return {
    family: asString(runtime.family || input.runtime_family || input.runtime, 'unknown'),
    adapter: asString(runtime.adapter || input.adapter || input.adapter_mode, null),
    session_id: asString(runtime.session_id || input.runtime_session_id, null),
    tool_use_id: asString(runtime.tool_use_id || input.tool_use_id, null),
  };
}

function normalizeOperation(input = {}) {
  const operation = asObject(input.operation);
  return {
    verb: asString(operation.verb || input.operation || input.verb, 'unknown'),
    category: asString(operation.category || input.category || input.action_type, 'unknown'),
    executable: asString(operation.executable || input.executable || input.tool_name, null),
    raw: asString(operation.raw || input.raw_operation, null),
  };
}

function normalizeResource(input = {}) {
  const resource = asObject(input.resource);
  const systems = asStringArray(input.systems_touched || resource.systems);
  return {
    system: asString(resource.system || input.system || systems[0], 'unknown'),
    systems,
    target: asString(resource.target || input.target || input.remote, null),
    subject: asString(resource.subject || input.subject || input.ref, null),
    uri: asString(resource.uri || input.uri, null),
  };
}

function normalizeEffect(input = {}) {
  const effect = asObject(input.effect);
  const reversible = typeof effect.reversible === 'boolean'
    ? effect.reversible
    : input.reversible === true;
  return {
    reversible,
    impact: asString(
      effect.impact || input.impact,
      reversible ? 'observation_or_reversible_change' : 'external_side_effect'
    ),
    blast_radius: asString(effect.blast_radius || input.blast_radius, 'unknown'),
    data_movement: asString(effect.data_movement || input.data_movement, null),
  };
}

function normalizeAuthorityBoundary(input = {}) {
  const boundary = asObject(input.authority_boundary);
  return {
    final_authority: asString(boundary.final_authority || input.final_authority, 'pcaa'),
    policy_id: asString(boundary.policy_id || input.policy_id || input.external_policy_reference, null),
    approval_required: boundary.approval_required === true || input.approval_required === true,
    authority_class: asString(boundary.authority_class || input.authority_class, null),
  };
}

function normalizeDataBoundary(input = {}) {
  const boundary = asObject(input.data_boundary);
  return {
    classification: asString(boundary.classification || input.data_classification, 'unspecified'),
    residency_region: asString(boundary.residency_region || input.data_residency_region, null),
    destination: asString(boundary.destination || input.destination || input.target, null),
    disclosure: asString(boundary.disclosure || input.disclosure, null),
  };
}

function normalizeApprovalBinding(input = {}) {
  const binding = asObject(input.approval_binding);
  return {
    mode: asString(binding.mode || input.approval_binding_mode || input.approval_binding, 'canonical_fingerprint'),
    required: binding.required === true || input.approval_required === true,
    scope: asString(binding.scope || input.approval_scope, 'single_action'),
  };
}

function semanticSeed(ir) {
  return {
    actor: ir.actor,
    operation: ir.operation,
    resource: ir.resource,
    effect: {
      reversible: ir.effect.reversible,
      impact: ir.effect.impact,
      blast_radius: ir.effect.blast_radius,
      data_movement: ir.effect.data_movement,
    },
    authority_boundary: ir.authority_boundary,
    data_boundary: ir.data_boundary,
    approval_binding: ir.approval_binding,
  };
}

export function createCavaIr(input = {}) {
  const ir = {
    schema_version: CAVA_IR_SCHEMA_VERSION,
    actor: normalizeActor(input),
    runtime: normalizeRuntime(input),
    operation: normalizeOperation(input),
    resource: normalizeResource(input),
    effect: normalizeEffect(input),
    authority_boundary: normalizeAuthorityBoundary(input),
    data_boundary: normalizeDataBoundary(input),
    approval_binding: normalizeApprovalBinding(input),
    attestation_refs: asStringArray(input.attestation_refs || input.attestationRefs),
    metadata: asObject(input.metadata),
  };

  return {
    ...ir,
    semantic_key: hashCanonicalValue(semanticSeed(ir)),
  };
}

export function validateCavaIr(ir = {}) {
  const missing = [];
  if (ir.schema_version !== CAVA_IR_SCHEMA_VERSION) missing.push('schema_version');
  if (!ir.semantic_key) missing.push('semantic_key');
  if (!ir.actor?.id) missing.push('actor.id');
  if (!ir.runtime?.family) missing.push('runtime.family');
  if (!ir.operation?.verb) missing.push('operation.verb');
  if (!ir.operation?.category) missing.push('operation.category');
  if (!ir.resource?.system) missing.push('resource.system');
  if (typeof ir.effect?.reversible !== 'boolean') missing.push('effect.reversible');
  return {
    valid: missing.length === 0,
    missing,
    schema_version: ir.schema_version || null,
  };
}
