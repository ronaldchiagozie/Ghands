import { aiService } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';

export type HandyJobDraft = {
  jobTitle: string;
  description: string;
};

export type HandyDraftResult =
  | { ok: true; draft: HandyJobDraft }
  | { ok: false; error: string };

export type HandyDraftInput = {
  categoryName?: string;
  /** Whatever the user has typed so far — used as steering, not as a requirement. */
  jobTitleHint?: string;
  descriptionHint?: string;
  minTitleLength: number;
  maxTitleLength: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
};

const NO_DRAFT_MESSAGE = 'Handy could not draft this one. Add a few words and try again.';

/** Trims to a word boundary so a clamped draft never ends mid-word. */
function clampToLength(raw: string, max: number): string {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

function buildPrompt(input: HandyDraftInput): string {
  const category = input.categoryName?.trim();
  const titleHint = input.jobTitleHint?.trim();
  const descriptionHint = input.descriptionHint?.trim();

  const lines = [
    'Draft a service request for me. Give me a short job title and a description a provider could quote from.',
    `Keep the title under ${input.maxTitleLength} characters and the description under ${input.maxDescriptionLength} characters.`,
  ];

  if (category) {
    lines.push(`Service category: ${category}.`);
  }
  if (titleHint) {
    lines.push(`Title I started writing: "${titleHint}".`);
  }
  if (descriptionHint) {
    lines.push(`Description I started writing: "${descriptionHint}".`);
  }
  if (!titleHint && !descriptionHint) {
    lines.push('I have not written anything yet, so base it on the category alone.');
  }

  return lines.join('\n');
}

/**
 * One-shot job draft over the conversational `/api/ai/chat` endpoint.
 *
 * The endpoint persists a conversation per call, so the record is deleted before
 * returning. That cleanup is in `finally` deliberately: it still runs when the
 * caller has unmounted and stopped listening, which is what keeps the assistant's
 * history free of one-off drafts.
 */
export async function generateHandyJobDraft(input: HandyDraftInput): Promise<HandyDraftResult> {
  let conversationId: number | undefined;

  try {
    const response = await aiService.sendMessage({ message: buildPrompt(input) });
    conversationId = response.conversationId;

    const suggestion = response.suggestion;
    if (!suggestion) {
      return { ok: false, error: NO_DRAFT_MESSAGE };
    }

    const jobTitle = clampToLength(suggestion.jobTitle ?? '', input.maxTitleLength);
    const description = clampToLength(suggestion.description ?? '', input.maxDescriptionLength);

    // Both fields have to land or the chip would half-fill the form.
    if (
      jobTitle.length < input.minTitleLength ||
      description.length < input.minDescriptionLength
    ) {
      return { ok: false, error: NO_DRAFT_MESSAGE };
    }

    return { ok: true, draft: { jobTitle, description } };
  } catch (error: unknown) {
    return { ok: false, error: getSpecificErrorMessage(error as Error, 'generic') };
  } finally {
    if (conversationId != null) {
      void aiService.deleteConversation(conversationId).catch(() => {});
    }
  }
}
