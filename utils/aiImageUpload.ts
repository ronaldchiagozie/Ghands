import { API_BASE_URL } from '@/lib/apiConfig';
import { authService } from '@/services/authService';

export function guessMimeAndName(uri: string, index: number): { name: string; type: string } {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) {
    return { name: `photo-${index}.png`, type: 'image/png' };
  }
  if (lower.includes('.webp')) {
    return { name: `photo-${index}.webp`, type: 'image/webp' };
  }
  if (lower.includes('.heic') || lower.includes('.heif')) {
    return { name: `photo-${index}.heic`, type: 'image/heic' };
  }
  return { name: `photo-${index}.jpg`, type: 'image/jpeg' };
}

function extractUploadedUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const candidates = [
    o.imageUrl,
    o.url,
    (o.data as Record<string, unknown> | undefined)?.url,
    (o.data as Record<string, unknown> | undefined)?.imageUrl,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

/** Uploads a local image URI. Returns remote URL, or local URI if upload fails. */
export async function uploadImageUri(localUri: string, index = 0): Promise<string> {
  const token = await authService.getAuthToken();
  const { name, type } = guessMimeAndName(localUri, index);
  const formData = new FormData();
  formData.append('image', { uri: localUri, name, type } as unknown as Blob);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      return localUri;
    }

    const json = await response.json().catch(() => null);
    return extractUploadedUrl(json) ?? localUri;
  } catch {
    return localUri;
  }
}

export async function uploadImageUris(localUris: string[]): Promise<string[]> {
  return Promise.all(localUris.map((uri, index) => uploadImageUri(uri, index)));
}
