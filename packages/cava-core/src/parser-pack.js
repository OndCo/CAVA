import { canonicalizeRuntimeEvent } from './adapter.js';
import { createCanonicalAction, validateCanonicalAction } from './schema.js';
import { hashCanonicalValue } from './hash.js';
import { normalizeCavaProfile } from './profile.js';

export const CAVA_DECOMPOSITION_SCHEMA_VERSION = 'osuite.cava.decomposition.v1';

function normalizePackId(pack = {}) {
  const id = String(pack.id || '').trim();
  const version = String(pack.version || '').trim();
  if (!id) throw new TypeError('CAVA parser packs must provide an id.');
  if (!version) throw new TypeError('CAVA parser packs must provide a version.');
  return `${id}@${version}`;
}

function canonicalFingerprint(action = {}) {
  return hashCanonicalValue(action);
}

function actionRisk(action = {}, profile) {
  const category = action.category || 'unknown';
  const configured = profile.category_risk?.[category];
  return Number.isFinite(Number(configured)) ? Number(configured) : profile.category_risk?.unknown ?? 50;
}

function prioritizeActions(actions = [], profile) {
  return [...actions].sort((left, right) => {
    const riskDelta = actionRisk(right, profile) - actionRisk(left, profile);
    if (riskDelta !== 0) return riskDelta;
    if (left.reversible !== right.reversible) return left.reversible ? 1 : -1;
    return 0;
  });
}

function highImpactCategories(actions = [], profile) {
  return [...new Set(actions
    .filter((action) => action.reversible === false || actionRisk(action, profile) >= 75)
    .map((action) => action.category)
    .filter(Boolean))];
}

function normalizeParsedActions(parsed) {
  if (!parsed) return [];
  const actionLike = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.actions)
      ? parsed.actions
      : [parsed];
  return actionLike
    .filter(Boolean)
    .map((action) => createCanonicalAction(action))
    .filter((action) => validateCanonicalAction(action).valid);
}

export function defineParserPack(pack = {}) {
  if (typeof pack.parse !== 'function') {
    throw new TypeError('CAVA parser packs must provide parse(rawEvent, context).');
  }
  const packId = normalizePackId(pack);
  return Object.freeze({
    id: String(pack.id).trim(),
    version: String(pack.version).trim(),
    parser_pack_id: packId,
    capabilities: Array.isArray(pack.capabilities) ? [...pack.capabilities] : [],
    match: typeof pack.match === 'function' ? pack.match : () => true,
    parse: pack.parse,
  });
}

export function composeParserPacks(packs = []) {
  const parserPacks = packs.map((pack) => (pack?.parser_pack_id ? pack : defineParserPack(pack)));
  return Object.freeze({
    parser_packs: parserPacks,
    parse(rawEvent = {}, context = {}) {
      const actions = [];
      const parserPackIds = [];
      const warnings = [];

      for (const pack of parserPacks) {
        try {
          if (pack.match(rawEvent, context) === false) continue;
          const parsed = normalizeParsedActions(pack.parse(rawEvent, context));
          if (parsed.length === 0) continue;
          actions.push(...parsed);
          parserPackIds.push(pack.parser_pack_id);
        } catch (error) {
          warnings.push({
            parser_pack_id: pack.parser_pack_id,
            code: 'parser_pack_failed',
            message: error?.message || String(error),
          });
        }
      }

      return { actions, parser_pack_ids: parserPackIds, warnings };
    },
  });
}

export function buildCavaDecomposition(actions = [], options = {}) {
  const profile = normalizeCavaProfile(options.profile || {});
  const normalizedActions = actions.map((action) => createCanonicalAction(action));
  const prioritized = prioritizeActions(normalizedActions, profile);
  const primary = prioritized[0] || createCanonicalAction({
    runtime: 'unknown',
    operation: 'unknown',
    category: 'unknown',
    systems_touched: [],
    reversible: true,
  });
  const fingerprints = prioritized.map(canonicalFingerprint);

  return {
    schema_version: CAVA_DECOMPOSITION_SCHEMA_VERSION,
    primary_action: primary,
    actions: prioritized,
    fingerprints,
    primary_fingerprint: fingerprints[0] || canonicalFingerprint(primary),
    secondary_fingerprints: fingerprints.slice(1),
    secondary_actions: prioritized.slice(1),
    action_count: prioritized.length,
    high_impact_categories: highImpactCategories(prioritized, profile),
    parser_pack_ids: [...new Set(options.parserPackIds || options.parser_pack_ids || [])],
    warnings: Array.isArray(options.warnings) ? options.warnings : [],
  };
}

export function decomposeRuntimeEvent(rawEvent = {}, options = {}) {
  const profile = normalizeCavaProfile(options.profile || {});
  const parser = composeParserPacks(options.parserPacks || options.parser_packs || []);
  const parsed = parser.parse(rawEvent, { ...options, profile });

  if (parsed.actions.length > 0) {
    return buildCavaDecomposition(parsed.actions, {
      profile,
      parserPackIds: parsed.parser_pack_ids,
      warnings: parsed.warnings,
    });
  }

  const fallback = canonicalizeRuntimeEvent(rawEvent, {
    adapter: options.adapter,
    profile,
  });
  return buildCavaDecomposition([fallback.action], {
    profile,
    parserPackIds: options.adapter?.id ? [options.adapter.id] : [],
    warnings: parsed.warnings,
  });
}
