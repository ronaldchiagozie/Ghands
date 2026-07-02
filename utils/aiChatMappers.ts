import type { AiMessage, AiSuggestion } from '@/components/ai/chat/types';
import type {
  AiBookingSuggestion,
  AiChatResponse,
  AiConversationMessage,
  AiEstimate,
} from '@/services/api/ai';
import { normalizeCategoryName } from '@/utils/categoryMapping';
import { formatAiChatTime } from '@/hooks/useRevealText';

function bookingPrefillFromSuggestion(suggestion: AiBookingSuggestion) {
  return {
    categoryName:
      normalizeCategoryName(suggestion.serviceType) || suggestion.serviceType,
    jobTitle: suggestion.jobTitle,
    description: suggestion.description,
  };
}

function formatEstimateRange(estimate: AiEstimate): string {
  const min = estimate.minNgn.toLocaleString('en-NG');
  const max = estimate.maxNgn.toLocaleString('en-NG');
  return `₦${min} – ₦${max}`;
}

function hasValidEstimate(estimate?: AiEstimate): boolean {
  return (
    estimate != null &&
    Number.isFinite(estimate.minNgn) &&
    Number.isFinite(estimate.maxNgn)
  );
}

/** API may include an empty suggestion object on plain text replies — ignore those. */
export function isActionableApiSuggestion(
  suggestion: AiBookingSuggestion | undefined | null,
  options?: { estimate?: AiEstimate; responseType?: AiChatResponse['responseType'] }
): boolean {
  if (!suggestion) return false;
  if (suggestion.askToBook === false) return false;

  const description = suggestion.description?.trim() ?? '';
  const jobTitle = suggestion.jobTitle?.trim() ?? '';
  const serviceType = suggestion.serviceType?.trim() ?? '';
  const hasBookingFields = Boolean(jobTitle || serviceType);
  const hasDescription = description.length > 0;

  if (options?.responseType === 'estimate' && hasValidEstimate(options.estimate)) {
    return true;
  }

  if (options?.responseType === 'suggestion') {
    return hasDescription || hasBookingFields;
  }

  return hasDescription || hasBookingFields;
}

/** UI card needs visible draft text or an estimate preview — not an empty shell. */
export function isRenderableUiSuggestion(
  suggestion: AiSuggestion | null | undefined
): suggestion is AiSuggestion {
  if (!suggestion) return false;

  const body = suggestion.body?.trim() ?? '';
  if (body.length > 0) return true;

  return (
    suggestion.variant === 'booking' &&
    Boolean(suggestion.previewValue?.trim())
  );
}

export function mapApiSuggestion(
  suggestion: AiBookingSuggestion,
  estimate?: AiEstimate
): AiSuggestion {
  if (estimate) {
    return {
      id: `suggestion-${Date.now()}`,
      variant: 'booking',
      title: 'Suggestion',
      previewLabel: 'Estimated cost',
      previewValue: formatEstimateRange(estimate),
      body: suggestion.description,
      ctaLabel: 'Use draft',
      bookingPrefill: bookingPrefillFromSuggestion(suggestion),
    };
  }

  return {
    id: `suggestion-${Date.now()}`,
    variant: 'draft',
    title: 'Suggestion',
    body: suggestion.description,
    ctaLabel: 'Use draft',
    bookingPrefill: bookingPrefillFromSuggestion(suggestion),
  };
}

export function mapChatResponseToUi(response: AiChatResponse): {
  botMessage: AiMessage;
  suggestion: AiSuggestion | null;
} {
  const botMessage: AiMessage = {
    id: `bot-${Date.now()}`,
    role: 'assistant',
    text: response.message,
    time: formatAiChatTime(),
    revealText: true,
  };

  let suggestion: AiSuggestion | null = null;

  if (
    isActionableApiSuggestion(response.suggestion, {
      estimate: response.estimate,
      responseType: response.responseType,
    })
  ) {
    suggestion = mapApiSuggestion(
      response.suggestion!,
      response.responseType === 'estimate' ? response.estimate : undefined
    );
  }

  if (suggestion && !isRenderableUiSuggestion(suggestion)) {
    suggestion = null;
  }

  return { botMessage, suggestion };
}

export function mapStoredMessageToUi(message: AiConversationMessage): {
  message: AiMessage;
  suggestion: AiSuggestion | null;
} {
  const aiMessage: AiMessage = {
    id: String(message.id),
    role: message.role,
    text: message.content,
    time: formatAiChatTime(new Date(message.createdAt)),
    revealText: false,
  };

  const metaSuggestion = message.metadata?.suggestion;
  let suggestion: AiSuggestion | null = null;

  if (
    metaSuggestion &&
    message.role === 'assistant' &&
    isActionableApiSuggestion(metaSuggestion, {
      estimate: message.metadata?.estimate,
      responseType: message.responseType ?? undefined,
    })
  ) {
    suggestion = mapApiSuggestion(
      metaSuggestion,
      message.responseType === 'estimate' ? message.metadata?.estimate : undefined
    );
  }

  if (suggestion && !isRenderableUiSuggestion(suggestion)) {
    suggestion = null;
  }

  return { message: aiMessage, suggestion };
}
