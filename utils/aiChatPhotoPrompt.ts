/** True when Handy's reply is asking the user to share photos. */
export function botMessageRequestsPhotos(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.trim()) return false;
  if (/\bshare photos/.test(t)) return true;
  if (/\bphotos?\s+so i can/.test(t)) return true;
  if (/\b(send|attach|upload)\b/.test(t) && /\b(photo|picture|image)/.test(t)) return true;
  if (/\b(any|some)\s+(photos?|pictures?|images?)\b/.test(t) && t.includes('?')) return true;
  return false;
}
