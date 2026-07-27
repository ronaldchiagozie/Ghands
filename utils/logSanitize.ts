const SENSITIVE_KEY = /token|password|pin|secret|cookie|authorization(?!url)/i;

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[…]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 280) return `${value.slice(0, 280)}…`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeForLog(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = '[redacted]';
        continue;
      }
      if (key === 'authorizationUrl' && typeof val === 'string') {
        out[key] = '[kora-checkout-url]';
        continue;
      }
      out[key] = sanitizeForLog(val, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function summarizeForLog(value: unknown): string {
  try {
    const sanitized = sanitizeForLog(value);
    const json = JSON.stringify(sanitized);
    return json.length > 1200 ? `${json.slice(0, 1200)}…` : json;
  } catch {
    return String(value);
  }
}

/** Compact rows for transaction list API logging */
export function summarizeTransactionRows(
  rows: Array<Record<string, unknown>>,
): unknown[] {
  return rows.slice(0, 15).map((row) => ({
    id: row.id,
    reference: row.reference,
    type: row.type,
    status: row.status,
    amount: row.amount,
    completedAt: row.completedAt,
    failureReason: row.failureReason ?? row.failureMessage ?? row.reason,
  }));
}
