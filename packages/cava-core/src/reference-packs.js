import { defineParserPack } from './parser-pack.js';

const REFERENCE_PACK_DEFINITIONS = [
  {
    id: 'reference-mcp-tools',
    version: '0.1.0',
    runtime: 'mcp',
    description: 'Reference structured MCP tool-call projection for common source-control and payment examples.',
  },
  {
    id: 'reference-browser-automation',
    version: '0.1.0',
    runtime: 'browser',
    description: 'Reference browser event projection for obvious publish/share UI controls.',
  },
  {
    id: 'reference-cloud-cli',
    version: '0.1.0',
    runtime: 'cloud_cli',
    description: 'Reference cloud control-plane projection for identity and infrastructure examples.',
  },
  {
    id: 'reference-database',
    version: '0.1.0',
    runtime: 'database',
    description: 'Reference SQL verb projection for read versus mutation examples.',
  },
  {
    id: 'reference-payment',
    version: '0.1.0',
    runtime: 'payment',
    description: 'Reference payment event projection for financial-finality examples.',
  },
  {
    id: 'reference-web3',
    version: '0.1.0',
    runtime: 'web3',
    description: 'Reference wallet method projection for transaction examples.',
  },
];

function normalized(value) {
  return String(value || '').toLowerCase();
}

function hasAny(value, patterns = []) {
  const text = normalized(value);
  return patterns.some((pattern) => text.includes(pattern));
}

function referenceAction(rawEvent, fields) {
  return {
    runtime: rawEvent.runtime || fields.runtime || 'reference',
    executable: fields.executable || rawEvent.tool || rawEvent.provider || rawEvent.service || null,
    operation: fields.operation || rawEvent.operation || rawEvent.event || rawEvent.method || 'unknown',
    category: fields.category,
    systems_touched: fields.systems_touched || [rawEvent.provider || rawEvent.tool || rawEvent.runtime || 'unknown'],
    reversible: fields.reversible === true,
    target: rawEvent.target || rawEvent.selector || rawEvent.service || null,
    subject: rawEvent.subject || rawEvent.chain || null,
    metadata: {
      disclosure: 'reference_only',
    },
  };
}

export function listReferenceParserPackMetadata() {
  return REFERENCE_PACK_DEFINITIONS.map((pack) => ({
    ...pack,
    disclosure: 'reference_only',
  }));
}

export function getReferenceParserPacks() {
  return [
    defineParserPack({
      id: 'reference-mcp-tools',
      version: '0.1.0',
      capabilities: ['mcp_tool_projection'],
      match: (rawEvent) => normalized(rawEvent.runtime) === 'mcp',
      parse(rawEvent) {
        if (hasAny(rawEvent.tool, ['github', 'git']) && hasAny(rawEvent.operation, ['push', 'merge', 'release'])) {
          return [referenceAction(rawEvent, {
            executable: rawEvent.tool || 'github',
            operation: rawEvent.operation || 'push',
            category: 'deployment',
            systems_touched: ['git', 'github'],
            reversible: false,
          })];
        }
        if (hasAny(rawEvent.tool, ['stripe', 'payment']) || hasAny(rawEvent.operation, ['refund', 'charge', 'payout'])) {
          return [referenceAction(rawEvent, {
            executable: rawEvent.tool || 'payment',
            category: 'payment',
            systems_touched: ['payment'],
            reversible: false,
          })];
        }
        return [];
      },
    }),
    defineParserPack({
      id: 'reference-browser-automation',
      version: '0.1.0',
      capabilities: ['browser_action_projection'],
      match: (rawEvent) => normalized(rawEvent.runtime) === 'browser',
      parse(rawEvent) {
        if (hasAny(`${rawEvent.selector} ${rawEvent.label} ${rawEvent.event}`, ['publish', 'production', 'release', 'share-report'])) {
          return [referenceAction(rawEvent, {
            executable: 'browser',
            operation: rawEvent.event || 'click',
            category: hasAny(`${rawEvent.selector} ${rawEvent.label}`, ['share']) ? 'data_boundary' : 'deployment',
            systems_touched: ['browser'],
            reversible: false,
          })];
        }
        return [];
      },
    }),
    defineParserPack({
      id: 'reference-cloud-cli',
      version: '0.1.0',
      capabilities: ['cloud_control_plane_projection'],
      match: (rawEvent) => normalized(rawEvent.runtime) === 'cloud_cli',
      parse(rawEvent) {
        if (hasAny(`${rawEvent.service} ${rawEvent.operation}`, ['role', 'assignment', 'iam'])) {
          return [referenceAction(rawEvent, {
            executable: rawEvent.provider || 'cloud',
            category: 'identity_authority',
            systems_touched: [rawEvent.provider || 'cloud'],
            reversible: false,
          })];
        }
        if (hasAny(rawEvent.operation, ['deploy', 'apply', 'update', 'delete'])) {
          return [referenceAction(rawEvent, {
            executable: rawEvent.provider || 'cloud',
            category: 'infrastructure_change',
            systems_touched: [rawEvent.provider || 'cloud'],
            reversible: false,
          })];
        }
        return [];
      },
    }),
    defineParserPack({
      id: 'reference-database',
      version: '0.1.0',
      capabilities: ['sql_verb_projection'],
      match: (rawEvent) => normalized(rawEvent.runtime) === 'database',
      parse(rawEvent) {
        const sql = normalized(rawEvent.sql);
        if (!sql) return [];
        return [referenceAction(rawEvent, {
          executable: rawEvent.provider || 'database',
          operation: sql.split(/\s+/)[0] || 'query',
          category: /delete|drop|truncate|update|insert|alter/.test(sql) ? 'database_mutation' : 'observation',
          systems_touched: ['database'],
          reversible: !/delete|drop|truncate|update|insert|alter/.test(sql),
        })];
      },
    }),
    defineParserPack({
      id: 'reference-payment',
      version: '0.1.0',
      capabilities: ['payment_action_projection'],
      match: (rawEvent) => normalized(rawEvent.runtime) === 'payment',
      parse(rawEvent) {
        return [referenceAction(rawEvent, {
          executable: rawEvent.provider || 'payment',
          category: 'payment',
          systems_touched: [rawEvent.provider || 'payment'],
          reversible: false,
        })];
      },
    }),
    defineParserPack({
      id: 'reference-web3',
      version: '0.1.0',
      capabilities: ['wallet_method_projection'],
      match: (rawEvent) => normalized(rawEvent.runtime) === 'web3',
      parse(rawEvent) {
        if (hasAny(rawEvent.method, ['sendtransaction', 'eth_sendtransaction', 'signandsend'])) {
          return [referenceAction(rawEvent, {
            executable: rawEvent.chain || 'wallet',
            operation: rawEvent.method || 'send_transaction',
            category: 'web3_transaction',
            systems_touched: [rawEvent.chain || 'web3'],
            reversible: false,
          })];
        }
        return [];
      },
    }),
  ];
}
