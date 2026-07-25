/** Unwrap `{ data: { data: { firstName… } } }` and similar API envelopes. */
export function unwrapProfilePayload(raw: unknown): Record<string, unknown> {
  let current: unknown = raw;
  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== 'object') {
      return {};
    }
    const r = current as Record<string, unknown>;
    const hasUserFields =
      r.firstName != null ||
      r.lastName != null ||
      r.email != null ||
      r.phoneNumber != null ||
      r.companyName != null;
    if (hasUserFields) {
      return r;
    }
    if (r.data != null && typeof r.data === 'object') {
      current = r.data;
      continue;
    }
    return r;
  }
  return {};
}
