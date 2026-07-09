import * as Clipboard from 'expo-clipboard';

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    await Clipboard.setStringAsync(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function buildAiSuggestionCopyText(input: {
  title: string;
  body: string;
  previewLabel?: string;
  previewValue?: string;
}): string {
  const parts = [input.title.trim()];
  if (input.previewLabel?.trim()) {
    parts.push(input.previewLabel.trim());
  }
  if (input.previewValue?.trim()) {
    parts.push(input.previewValue.trim());
  }
  if (input.body.trim()) {
    parts.push(input.body.trim());
  }
  return parts.filter(Boolean).join('\n\n');
}
