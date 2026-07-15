import { CAVA_PROFILE_SCHEMA_VERSION } from './schema.js';

export const DEFAULT_CAVA_PROFILE = Object.freeze({
  schema_version: CAVA_PROFILE_SCHEMA_VERSION,
  id: 'default',
  mode: 'open_skeleton',
  category_risk: {
    observation: 10,
    read: 20,
    write: 45,
    build: 30,
    deployment: 78,
    infrastructure_plan: 35,
    infrastructure_change: 85,
    policy_degradation: 88,
    secret_access: 78,
    payment: 82,
    identity: 86,
    identity_authority: 86,
    data_boundary: 76,
    destructive: 92,
    unknown: 50,
  },
  action_aliases: {},
});

export function normalizeCavaProfile(input = {}) {
  return {
    ...DEFAULT_CAVA_PROFILE,
    ...input,
    schema_version: CAVA_PROFILE_SCHEMA_VERSION,
    category_risk: {
      ...DEFAULT_CAVA_PROFILE.category_risk,
      ...(input.category_risk || input.categoryRisk || {}),
    },
    action_aliases: {
      ...(input.action_aliases || input.actionAliases || {}),
    },
    mode: input.mode === 'enterprise_plugin' ? 'open_skeleton' : String(input.mode || DEFAULT_CAVA_PROFILE.mode),
  };
}
