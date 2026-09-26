/**
 * Whether an account from the API is a company. Identical in both apps.
 *
 * `accountType: 'company'` is what the backend sends on customers in
 * provider-facing job payloads; the snake-case and `isCompany` forms cover
 * other routes that have not been normalised.
 */
export function isCompanyAccount(person: unknown): boolean {
  if (!person || typeof person !== 'object') return false;
  const p = person as Record<string, unknown>;
  const type = String(p.accountType ?? p.account_type ?? '').toLowerCase();
  return type === 'company' || p.isCompany === true;
}
