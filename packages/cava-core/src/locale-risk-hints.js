export const CAVA_LOCALE_RISK_HINT_SCHEMA_VERSION = 'cava.locale_risk_hints.v1';

const LOCALE_LEXICONS = [
  {
    locale: 'ja',
    terms: [
      { category: 'sensitive_data', label: 'customer or personal data', pattern: /(顧客情報|顧客データ|個人情報|注文情報|注文メモ|機密情報|社外秘)/u },
      { category: 'secret_material', label: 'secret material', pattern: /(APIキー|秘密鍵|認証情報|アクセストークン|パスワード|シークレット|\.env)/iu },
      { category: 'external_egress', label: 'external egress', pattern: /(外部送信|外部共有|外部Slack|社外共有|メール送信|アップロード|共有します|送付|送信|公開チャンネル)/u },
      { category: 'public_persistence', label: 'public persistence', pattern: /(公開リンク|誰でもアクセス|公開URL|共有リンク|CSV出力|エクスポート)/u },
      { category: 'production_boundary', label: 'production boundary', pattern: /(本番環境|本番データ|prod|production|商用環境)/iu },
      { category: 'destructive_change', label: 'destructive or state-changing action', pattern: /(削除|消去|上書き|変更|更新|停止|無効化|権限変更|返金|送金|実行します)/u },
      { category: 'approval_gap', label: 'approval gap', pattern: /(承認は後で|事後承認|稟議前|未承認|承認なし|レビューなし)/u },
    ],
  },
  {
    locale: 'zh',
    terms: [
      { category: 'sensitive_data', label: 'customer or personal data', pattern: /(客户信息|客户数据|个人信息|订单信息|交易信息|支付信息|机密信息|内部资料|敏感数据)/u },
      { category: 'secret_material', label: 'secret material', pattern: /(API\s*密钥|私钥|认证信息|访问令牌|密码|token|secret|\.env)/iu },
      { category: 'external_egress', label: 'external egress', pattern: /(外部发送|外部共享|发到外部|上传|发送到|共享到|邮件发送|公开频道|外部Slack)/u },
      { category: 'public_persistence', label: 'public persistence', pattern: /(公开链接|任何人可访问|公开URL|分享链接|导出CSV|导出|下载)/u },
      { category: 'production_boundary', label: 'production boundary', pattern: /(生产环境|线上环境|生产数据|prod|production)/iu },
      { category: 'destructive_change', label: 'destructive or state-changing action', pattern: /(删除|清空|覆盖|修改|更新|停止|禁用|权限变更|退款|转账|执行)/u },
      { category: 'approval_gap', label: 'approval gap', pattern: /(事后审批|先执行后审批|未审批|未经批准|没有审批|无需审批|审批之后再说)/u },
    ],
  },
];

const READ_ONLY_NEGATION_PATTERNS = [
  /確認するだけ|見るだけ|閲覧のみ|読み取り専用|変更しない|削除しない|送信しない|行いません/u,
  /只读|仅查看|只是查看|不会修改|不修改|不删除|不发送|不执行/u,
  /\bread[- ]only\b|\bno\s+(?:change|delete|send|write|execute|mutation)s?\b/i,
];

function textFromInput(input = {}) {
  const summary = input.input_summary && typeof input.input_summary === 'object'
    ? input.input_summary
    : {};
  return [
    input.declared_goal,
    input.authorization_scope,
    input.instruction,
    input.destination,
    input.tool_input_excerpt,
    summary.instruction,
    summary.destination,
    summary.tool_input_excerpt,
  ].filter(Boolean).map(String).join('\n');
}

function uniqueHints(hints = []) {
  const seen = new Set();
  const result = [];
  for (const hint of hints) {
    const key = `${hint.locale}:${hint.category}:${hint.match}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(hint);
  }
  return result;
}

export function scanLocaleRiskHints(input = {}) {
  const text = textFromInput(input);
  const hints = [];
  for (const lexicon of LOCALE_LEXICONS) {
    for (const term of lexicon.terms) {
      const match = text.match(term.pattern);
      if (!match) continue;
      hints.push({
        locale: lexicon.locale,
        category: term.category,
        label: term.label,
        match: match[0],
      });
    }
  }

  const unique = uniqueHints(hints);
  const categories = new Set(unique.map((hint) => hint.category));
  const actionCategory = String(input.action_category || input.category || '').toLowerCase();
  const readOnlyIntent = READ_ONLY_NEGATION_PATTERNS.some((pattern) => pattern.test(text));
  const sensitive = categories.has('sensitive_data') || categories.has('secret_material');
  const egress = categories.has('external_egress') || categories.has('public_persistence');
  const mutation = categories.has('destructive_change');
  const approvalGap = categories.has('approval_gap');
  const production = categories.has('production_boundary');
  const observationOnly = actionCategory === 'observation' || (
    readOnlyIntent
    && input.reversible === true
    && !sensitive
    && !egress
    && !mutation
    && !approvalGap
  );
  const failClosed = unique.length > 0 && !observationOnly && (
    (sensitive && egress)
    || (approvalGap && (sensitive || egress || mutation || production))
    || (production && mutation)
  );

  return {
    schema_version: CAVA_LOCALE_RISK_HINT_SCHEMA_VERSION,
    hints: unique,
    categories: [...categories],
    confidence: unique.length > 0 ? (failClosed ? 0.76 : 0.62) : 0,
    observation_only: observationOnly,
    fail_closed: failClosed,
    note: 'Locale hints are secondary evidence. Runtime-structured action fields remain authoritative.',
  };
}
