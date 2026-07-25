type ReviewNameSource = Record<string, unknown>;

const GENERIC_REVIEWER_LABELS = new Set([
  'client',
  'user',
  'customer',
  'anonymous',
  'guest',
  'provider',
  'verified client',
  'service client',
]);

export function isGenericReviewerLabel(value: unknown): boolean {
  if (value == null) return true;
  const t = String(value).trim().toLowerCase();
  if (!t || /^null$/i.test(t) || /^undefined$/i.test(t)) return true;
  return GENERIC_REVIEWER_LABELS.has(t);
}

function cleanNamePart(value: unknown): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t || /^null$/i.test(t) || /^undefined$/i.test(t)) return null;
  if (isGenericReviewerLabel(t)) return null;
  return t;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Merge nested reviewer / user / client objects into one record for name lookup. */
export function flattenReviewRecord(raw: unknown): ReviewNameSource {
  if (!isObject(raw)) return {};
  const nestedKeys = ['reviewer', 'user', 'client', 'customer', 'reviewedBy', 'reviewed_by', 'author'];
  const fromNested: ReviewNameSource = {};
  for (const key of nestedKeys) {
    const bag = raw[key];
    if (isObject(bag)) {
      Object.assign(fromNested, bag);
    }
  }
  const data = raw.data;
  if (isObject(data)) {
    Object.assign(fromNested, data);
    for (const key of nestedKeys) {
      const bag = data[key];
      if (isObject(bag)) Object.assign(fromNested, bag);
    }
  }
  return { ...fromNested, ...raw };
}

function joinFirstLast(source: ReviewNameSource): string | null {
  const fn = cleanNamePart(
    source.firstName ??
      source.first_name ??
      source.givenName ??
      source.given_name,
  );
  const ln = cleanNamePart(
    source.lastName ?? source.last_name ?? source.familyName ?? source.family_name,
  );
  const joined = [fn, ln].filter(Boolean).join(' ').trim();
  return joined || null;
}

function pickFirstValidName(candidates: unknown[]): string | null {
  for (const c of candidates) {
    const part = cleanNamePart(c);
    if (part) return part;
  }
  return null;
}

/** Human-readable reviewer name for provider profile review lists. */
export function buildReviewerDisplayName(raw: unknown): string {
  const r = flattenReviewRecord(raw);

  const fromParts = joinFirstLast(r);
  if (fromParts) return fromParts;

  const direct = pickFirstValidName([
    r.reviewerName,
    r.reviewer_name,
    r.clientName,
    r.client_name,
    r.customerName,
    r.customer_name,
    r.authorName,
    r.author_name,
    r.displayName,
    r.display_name,
    r.fullName,
    r.full_name,
    r.name,
  ]);
  if (direct) return direct;

  const userName = cleanNamePart(r.userName ?? r.username ?? r.user_name);
  if (userName && userName.includes(' ')) return userName;

  const userId =
    r.userId ?? r.user_id ?? r.clientId ?? r.client_id ?? r.reviewerId ?? r.reviewer_id;
  if (userId != null && String(userId).trim()) {
    if (userName) return userName;
    return `Client · ${String(userId).slice(-4)}`;
  }

  if (userName) return userName;

  return 'Verified client';
}

export function reviewAvatarUrl(raw: unknown): string | null {
  const r = flattenReviewRecord(raw);
  const candidates = [
    r.reviewerImage,
    r.reviewer_image,
    r.profileImage,
    r.profile_image,
    r.profileImageUrl,
    r.profile_image_url,
    r.avatar,
    r.avatarUrl,
    r.avatar_url,
    r.image,
    r.photo,
    r.photoUrl,
    r.photo_url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) return c.trim();
  }
  return null;
}
