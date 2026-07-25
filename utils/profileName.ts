import { unwrapProfilePayload } from '@/utils/profilePayload';

/** Split a single "Full name" field into API firstName / lastName. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function deriveUserName(fullName: string, email?: string): string {
  const fromEmail = email?.split('@')[0]?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') ?? '';
  if (fromEmail.length >= 3) {
    return fromEmail.slice(0, 32);
  }
  const fromName = fullName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_]/g, '');
  if (fromName.length >= 3) {
    return fromName.slice(0, 32);
  }
  return `user${Date.now().toString().slice(-8)}`;
}

export function readProfileSignupFields(raw: unknown): {
  gender: string;
  userName?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { gender: 'other' };
  }
  const d = unwrapProfilePayload(raw);
  const genderRaw = String(d.gender ?? '').trim().toLowerCase();
  const gender =
    genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other'
      ? genderRaw
      : 'other';
  const userNameRaw = d.userName ?? d.username ?? d.user_name;
  const userName =
    typeof userNameRaw === 'string' && userNameRaw.trim() ? userNameRaw.trim() : undefined;
  return { gender, userName };
}
