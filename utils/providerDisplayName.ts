type ProviderNameSource = {
  name?: unknown;
  companyName?: unknown;
  company_name?: unknown;
  businessName?: unknown;
  displayName?: unknown;
};

/** Display name for a provider from nearby/list/detail API payloads. */
export function resolveProviderDisplayName(
  provider: ProviderNameSource,
  options?: { id?: number; categoryLabel?: string },
): string {
  const candidates = [
    provider.name,
    provider.companyName,
    provider.company_name,
    provider.businessName,
    provider.displayName,
  ];
  const rawName = candidates.map((c) => String(c ?? '').trim()).find((s) => s.length > 0) ?? '';

  const categoryLabel = options?.categoryLabel?.trim() ?? '';
  const normalizedCategory = categoryLabel.toLowerCase().replace(/[\s_-]/g, '');
  const slug = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
  const nameLooksLikeCategory =
    !!rawName &&
    !!normalizedCategory &&
    slug(rawName) === slug(normalizedCategory);

  if (rawName && !nameLooksLikeCategory) {
    return rawName;
  }

  const id = options?.id;
  if (id != null && Number.isFinite(Number(id))) {
    return `Service provider #${id}`;
  }

  return rawName || 'Service provider';
}
