/**
 * Keys for the backend's `Idempotency-Key` header on money-moving requests.
 *
 * The server replays the original response for a repeated key within ~24h
 * instead of performing the operation again, so a payment retried after an
 * uncertain failure cannot debit twice.
 *
 * The key must therefore be *stable across retries of the same intent* and
 * fresh for a genuinely new one. Callers mint one per attempt session - e.g.
 * when a payment screen opens for a given request - and reuse it for every
 * attempt on that screen.
 *
 * No crypto dependency: these only need to be unique, not unguessable. The
 * server scopes them by requester, so a collision would have to occur within
 * one account within 24 hours.
 */
export function createIdempotencyKey(scope: string): string {
  const random = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${scope}-${Date.now().toString(36)}-${random}`.slice(0, 96);
}
