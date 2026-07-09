import { normalizeUiPunctuation } from '@/utils/copy';

const GREETING_PREFIX =
  /^(hi|hello|hey|good morning|good afternoon|good evening)[,!.\s]+/i;

const META_SENTENCE =
  /^(please (let me know|share|advise|confirm)|looking forward|thank you|thanks|let me know|feel free to)/i;

/** Trailing availability / pricing asks that belong in chat, not on a job card. */
const META_TAIL =
  /\.\s*(please let me know.+|please share.+|your earliest availability.+|estimated cost.+)$/i;

type SummarizeOptions = {
  maxLength?: number;
  maxSentences?: number;
  jobTitle?: string;
  fallback?: string;
};

function normalizeDescription(raw: string): string {
  return normalizeUiPunctuation(
    raw
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/,\s*,+/g, ',')
      .replace(GREETING_PREFIX, '')
      .replace(META_TAIL, '')
      .trim(),
  );
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !META_SENTENCE.test(part));
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  const cut =
    lastSpace > maxLength * 0.55 ? slice.slice(0, lastSpace) : slice;

  return `${cut.replace(/[,\s.!?]+$/, '')}…`;
}

/**
 * Short, card-friendly summary of a job description.
 * Keeps the issue and urgency; drops greetings and meta requests.
 */
export function summarizeJobDescription(
  raw: string | null | undefined,
  options: SummarizeOptions = {}
): string {
  const {
    maxLength = 100,
    maxSentences = 2,
    jobTitle,
    fallback = 'Service request',
  } = options;

  if (!raw?.trim()) {
    return jobTitle?.trim() || fallback;
  }

  let text = normalizeDescription(raw);
  if (!text) {
    return jobTitle?.trim() || fallback;
  }

  const sentences = splitSentences(text);
  if (sentences.length > 0) {
    const picked: string[] = [];
    let length = 0;

    for (const sentence of sentences) {
      if (picked.length >= maxSentences) {
        break;
      }

      const nextLength = picked.length === 0 ? sentence.length : length + 1 + sentence.length;
      if (nextLength > maxLength && picked.length > 0) {
        break;
      }

      picked.push(sentence);
      length = nextLength;
    }

    if (picked.length > 0) {
      text = picked.join(' ');
    }
  }

  text = truncateAtWord(text, maxLength);

  const normalizedTitle = jobTitle?.trim().toLowerCase();
  if (
    normalizedTitle &&
    text.toLowerCase() === normalizedTitle &&
    sentences.length > 1
  ) {
    return truncateAtWord(sentences.slice(0, maxSentences).join(' '), maxLength);
  }

  return text || jobTitle?.trim() || fallback;
}
