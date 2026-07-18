import { createCavaIr } from './ir.js';

function normalizeIr(value) {
  return value?.semantic_key ? value : createCavaIr(value || {});
}

export function projectCavaToOpenTelemetry(irInput = {}) {
  const ir = normalizeIr(irInput);
  return {
    'cava.schema_version': ir.schema_version,
    'cava.semantic_key': ir.semantic_key,
    'cava.actor.id': ir.actor.id,
    'cava.actor.type': ir.actor.type,
    'cava.runtime.family': ir.runtime.family,
    'cava.runtime.adapter': ir.runtime.adapter,
    'cava.operation.verb': ir.operation.verb,
    'cava.operation.category': ir.operation.category,
    'cava.operation.executable': ir.operation.executable,
    'cava.resource.system': ir.resource.system,
    'cava.resource.target': ir.resource.target,
    'cava.resource.subject': ir.resource.subject,
    'cava.effect.reversible': ir.effect.reversible,
    'cava.effect.impact': ir.effect.impact,
    'cava.authority.final': ir.authority_boundary.final_authority,
    'cava.authority.policy_id': ir.authority_boundary.policy_id,
    'gen_ai.operation.name': 'execute_tool',
  };
}

export function buildCavaInTotoStatement(irInput = {}, options = {}) {
  const ir = normalizeIr(irInput);
  const subjectName = typeof options.subjectName === 'string' && options.subjectName.trim()
    ? options.subjectName.trim()
    : ir.semantic_key;
  return {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      {
        name: subjectName,
        digest: {
          sha256: ir.semantic_key,
        },
      },
    ],
    predicateType: options.predicateType || 'https://cava.dev/schemas/ir/v1',
    predicate: {
      semantic_key: ir.semantic_key,
      ir,
    },
  };
}
