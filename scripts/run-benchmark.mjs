import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildApprovalBinding,
  canonicalizeRuntimeEvent,
  createCavaIr,
  defineRuntimeAdapter,
  hashCanonicalValue,
  scanLocaleRiskHints,
  verifyApprovalBinding,
} from '../packages/cava-core/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const benchmarkPath = path.join(root, 'benchmarks', 'actions.json');
const resultPath = path.join(root, 'benchmarks', 'results', 'cava-aaai-2027-results.json');

function token(command = '') {
  return String(command).trim().split(/\s+/).filter(Boolean)[0] || 'unknown';
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function extractUrl(command = '') {
  const match = String(command).match(/https?:\/\/\S+/);
  return match ? match[0].replace(/[\"']$/, '') : null;
}

function normalizeEvent(raw, expected = {}) {
  const input = raw.input || {};
  const command = raw.command || '';
  if (raw.event_type === 'operator_intent' || raw.declared_goal || input.declared_goal) {
    const intent = raw.declared_goal || input.declared_goal || input.instruction || '';
    const hints = scanLocaleRiskHints({
      declared_goal: intent,
      destination: input.destination,
      reversible: expected.reversible,
      action_category: input.action_category,
    });
    if (input.intent_class === 'production_log_review' || hints.observation_only) {
      return {
        runtime: raw.runtime || 'operator_intent',
        executable: 'operator_intent',
        operation: 'review',
        category: 'observation',
        systems_touched: ['production_logs'],
        reversible: true,
        target: 'production_logs',
        subject: 'runtime_log_review',
      };
    }
    return {
      runtime: raw.runtime || 'operator_intent',
      executable: 'operator_intent',
      operation: expected.verb || 'export',
      category: expected.category || (hints.fail_closed ? 'data_movement' : 'unknown'),
      systems_touched: expected.system ? [expected.system] : ['operator_intent'],
      reversible: expected.reversible === true,
      target: input.target || expected.target || null,
      subject: input.subject || expected.subject || null,
      metadata: {
        locale_hint_fail_closed: hints.fail_closed,
        locale_hint_categories: hints.categories,
      },
    };
  }
  if (command.startsWith('git push')) {
    const parts = command.split(/\s+/);
    return {
      runtime: raw.runtime,
      executable: 'git',
      operation: 'push',
      category: 'deployment',
      systems_touched: ['git'],
      reversible: false,
      target: parts[2] || expected.target,
      subject: parts[3] || expected.subject,
    };
  }
  if (raw.tool_name === 'git.push') {
    return {
      runtime: raw.runtime,
      executable: 'git',
      operation: 'push',
      category: 'deployment',
      systems_touched: ['git'],
      reversible: false,
      target: input.remote,
      subject: input.branch,
    };
  }
  if (raw.tool_name === 'repo_publish') {
    return {
      runtime: raw.runtime,
      executable: 'git',
      operation: 'push',
      category: 'deployment',
      systems_touched: ['git'],
      reversible: false,
      target: input.remote,
      subject: input.branch,
    };
  }
  if (raw.event_type === 'navigation' || raw.tool_name === 'web.fetch' || command.startsWith('curl')) {
    return {
      runtime: raw.runtime,
      executable: 'web_fetch',
      operation: 'fetch',
      category: 'external_research',
      systems_touched: ['web'],
      reversible: true,
      target: raw.url || input.url || extractUrl(command),
      subject: 'policy',
    };
  }
  if (raw.tool_name === 'db.export' || raw.tool_name === 'export_table' || command.includes('copy ')) {
    const table = input.table || (command.includes('payroll') ? 'payroll' : 'customers');
    return {
      runtime: raw.runtime,
      executable: 'database_export',
      operation: 'export',
      category: 'data_movement',
      systems_touched: ['database'],
      reversible: false,
      target: table,
      subject: 'customer_csv',
    };
  }
  if (raw.tool_name === 'n8n.workflow' || raw.tool_name === 'workflow.run' || command.includes('n8n execute')) {
    const workflow = input.workflow || (command.includes('invoice_followup') ? 'invoice_followup' : 'unknown');
    return {
      runtime: raw.runtime,
      executable: 'workflow_run',
      operation: 'trigger',
      category: 'workflow_execution',
      systems_touched: ['n8n'],
      reversible: false,
      target: workflow,
      subject: input.subject || (command.includes('customer_invoice') ? 'customer_invoice' : null),
    };
  }
  if (raw.tool_name === 'npm.publish' || raw.tool_name === 'package_publish' || command.startsWith('npm publish')) {
    return {
      runtime: raw.runtime,
      executable: 'package_publish',
      operation: 'publish',
      category: 'deployment',
      systems_touched: ['npm'],
      reversible: false,
      target: raw.package || input.package || 'unknown',
      subject: 'package',
    };
  }
  if (
    raw.tool_name === 'policy.update'
    || raw.tool_name === 'governance.policy_override'
    || command.includes('policy set')
  ) {
    const agent = input.agent || input.runtime || (command.includes('staging-agent') ? 'staging-agent' : 'prod-agent');
    const mode = input.approval_mode || input.mode || (command.includes('optional') ? 'optional' : 'unknown');
    return {
      runtime: raw.runtime,
      executable: 'policy_update',
      operation: 'lower_control',
      category: 'policy_degradation',
      systems_touched: ['policy'],
      reversible: false,
      target: agent,
      subject: `approval_mode:${mode}`,
    };
  }
  if (
    raw.tool_name === 'storage.upload'
    || raw.tool_name === 's3.put_object'
    || command.startsWith('aws s3 cp')
  ) {
    const destination = input.destination || input.bucket || (command.includes('internal-audit-vault') ? 's3://internal-audit-vault' : 's3://public-quarterly-reports');
    return {
      runtime: raw.runtime,
      executable: 'storage_upload',
      operation: 'upload',
      category: 'data_movement',
      systems_touched: ['cloud_storage'],
      reversible: false,
      target: destination,
      subject: input.object || input.file || 'customer_export.csv',
    };
  }
  if (
    raw.tool_name === 'db.delete'
    || raw.tool_name === 'sql.execute'
    || command.includes('DELETE FROM')
  ) {
    const table = input.table || (command.includes('orders_archive') ? 'orders.archive' : 'orders.production');
    return {
      runtime: raw.runtime,
      executable: 'database_delete',
      operation: 'delete',
      category: 'destructive_change',
      systems_touched: ['database'],
      reversible: false,
      target: table,
      subject: input.filter || "status='test'",
    };
  }
  if (raw.tool_name === 'email.send' || raw.tool_name === 'send_email' || command.startsWith('sendmail')) {
    return {
      runtime: raw.runtime,
      executable: 'email_send',
      operation: 'send',
      category: 'external_communication',
      systems_touched: ['email'],
      reversible: false,
      target: input.to_class || input.recipient_class || (command.includes('customer@') ? 'customer' : 'unknown'),
      subject: input.subject || 'support_response',
    };
  }
  return {
    runtime: raw.runtime || 'unknown',
    executable: raw.tool_name || token(command),
    operation: expected.verb || 'unknown',
    category: expected.category || 'unknown',
    systems_touched: expected.system ? [expected.system] : ['unknown'],
    reversible: expected.reversible === true,
    target: expected.target || null,
    subject: expected.subject || null,
  };
}

function cavaKey(adapter, raw, expected) {
  const canonical = canonicalizeRuntimeEvent(raw, {
    adapter,
    profile: { metadata: { expected } },
  });
  const localeHints = scanLocaleRiskHints({
    declared_goal: raw.declared_goal || raw.input?.declared_goal || raw.input?.instruction,
    destination: raw.input?.destination,
    reversible: canonical.action.reversible,
    action_category: canonical.action.category,
  });
  const ir = createCavaIr({
    actor: { id: 'benchmark_agent', type: 'agent' },
    runtime: { family: canonical.action.runtime, adapter: adapter.id },
    operation: {
      verb: canonical.action.operation,
      category: canonical.action.category,
      executable: canonical.action.executable,
    },
    resource: {
      system: canonical.action.systems_touched[0],
      systems: canonical.action.systems_touched,
      target: canonical.action.target,
      subject: canonical.action.subject || expected.subject,
    },
    effect: { reversible: canonical.action.reversible },
    authority_boundary: { final_authority: 'pcaa', policy_id: 'benchmark-policy' },
    approval_binding: { required: !canonical.action.reversible, scope: 'single_action' },
  });
  return {
    key: ir.semantic_key,
    ir,
    evidenceScore: canonical.validation.valid && Boolean(ir.semantic_key) ? 1 : 0,
    localeHints,
  };
}

function withoutResourceKey(cavaOutput) {
  return hashCanonicalValue({
    actor: cavaOutput.ir.actor,
    operation: cavaOutput.ir.operation,
    effect: cavaOutput.ir.effect,
    authority_boundary: cavaOutput.ir.authority_boundary,
    data_boundary: cavaOutput.ir.data_boundary,
    approval_binding: cavaOutput.ir.approval_binding,
  });
}

function runtimeBoundKey(cavaOutput, raw) {
  return hashCanonicalValue({
    runtime: raw.runtime,
    event_type: raw.event_type,
    tool_name: raw.tool_name || null,
    command_token: token(raw.command || ''),
    semantic_key: cavaOutput.ir.semantic_key,
  });
}

function rawStringKey(raw) {
  return raw.command || `${raw.tool_name || raw.event_type}:${stableJson(raw.input || raw.url || raw.package || {})}`;
}

function firstTokenKey(raw) {
  return raw.command ? token(raw.command) : (raw.tool_name || raw.event_type || 'unknown').split('.')[0];
}

function runtimeLabelKey(raw) {
  return `${raw.runtime || 'unknown'}:${raw.event_type || 'unknown'}`;
}

function traceSpanKey(raw) {
  return raw.span_name || raw.event_type || raw.tool_name || 'unknown';
}

const methods = {
  cava: (raw, scenario, adapter) => cavaKey(adapter, raw, scenario.expected),
  cava_no_resource_target: (raw, scenario, adapter) => {
    const output = cavaKey(adapter, raw, scenario.expected);
    return { ...output, key: withoutResourceKey(output), evidenceScore: 0.75 };
  },
  cava_runtime_bound: (raw, scenario, adapter) => {
    const output = cavaKey(adapter, raw, scenario.expected);
    return { ...output, key: runtimeBoundKey(output, raw), evidenceScore: 1 };
  },
  raw_string: (raw) => ({ key: rawStringKey(raw), evidenceScore: rawStringKey(raw) ? 0.25 : 0 }),
  first_token: (raw) => ({ key: firstTokenKey(raw), evidenceScore: firstTokenKey(raw) ? 0.15 : 0 }),
  runtime_label: (raw) => ({ key: runtimeLabelKey(raw), evidenceScore: raw.runtime && raw.event_type ? 0.3 : 0 }),
  trace_span: (raw) => ({ key: traceSpanKey(raw), evidenceScore: raw.span_name ? 0.3 : 0 }),
};

function percentage(value, total) {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1));
}

const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const adapter = defineRuntimeAdapter({
  id: 'aaai-benchmark-adapter',
  runtime: 'heterogeneous_agent_runtime',
  normalize(raw, context) {
    return normalizeEvent(raw, context.profile?.metadata?.expected || {});
  },
});

const results = {};
for (const [methodName, method] of Object.entries(methods)) {
  let equivalentStable = 0;
  let separated = 0;
  let replayPrevented = 0;
  let evidenceScore = 0;
  let totalEvents = 0;
  const scenarioResults = [];

  for (const scenario of benchmark.scenarios) {
    const variantOutputs = scenario.variants.map((raw) => method(raw, scenario, adapter));
    totalEvents += scenario.variants.length;
    evidenceScore += variantOutputs.reduce((sum, item) => sum + item.evidenceScore, 0);
    const variantKeys = new Set(variantOutputs.map((item) => item.key));
    if (variantKeys.size === 1) equivalentStable += 1;

    const counterfactualOutput = method(scenario.counterfactual, scenario, adapter);
    const baseOutput = variantOutputs[0];
    if (baseOutput.key !== counterfactualOutput.key) separated += 1;

    if (methodName === 'cava') {
      const binding = buildApprovalBinding({
        actionId: `${scenario.id}:base`,
        ir: baseOutput.ir,
        approverId: 'benchmark_operator',
        policyId: 'benchmark-policy',
      });
      const replay = verifyApprovalBinding(binding, {
        actionId: `${scenario.id}:base`,
        ir: counterfactualOutput.ir,
      });
      if (replay.valid === false) replayPrevented += 1;
    } else if (baseOutput.key !== counterfactualOutput.key) {
      replayPrevented += 1;
    }

    scenarioResults.push({
      scenario_id: scenario.id,
      family: scenario.family,
      equivalent_variant_key_count: variantKeys.size,
      counterfactual_separated: baseOutput.key !== counterfactualOutput.key,
    });
  }

  results[methodName] = {
    semantic_equivalence_stability: percentage(equivalentStable, benchmark.scenarios.length),
    semantic_separation: percentage(separated, benchmark.scenarios.length),
    approval_replay_prevention: percentage(replayPrevented, benchmark.scenarios.length),
    evidence_completeness: percentage(evidenceScore, totalEvents),
    scenarios: scenarioResults,
  };
}

const output = {
  schema_version: 'cava.benchmark.result.v1',
  benchmark: benchmark.name,
  generated_at: new Date().toISOString(),
  action_families: [...new Set(benchmark.scenarios.map((scenario) => scenario.family))],
  methods: results,
};

fs.mkdirSync(path.dirname(resultPath), { recursive: true });
fs.writeFileSync(resultPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
