export type AiViewMode = 'home' | 'chat' | 'unavailable';

export type AiMessageRole = 'user' | 'assistant';

export type AiImageAttachment = {
  id: string;
  uri?: string;
  loading?: boolean;
};

export type AiMessage = {
  id: string;
  role: AiMessageRole;
  text: string;
  time: string;
  attachments?: AiImageAttachment[];
  /** When true, assistant text reveals with a typewriter effect. */
  revealText?: boolean;
};

export type AiSuggestionVariant = 'booking' | 'draft';

/** Pre-filled booking data — skips category & job details, lands on date/time. */
export type AiBookingPrefill = {
  categoryName: string;
  jobTitle: string;
  description: string;
};

export type AiSuggestion = {
  id: string;
  variant: AiSuggestionVariant;
  title: string;
  previewLabel?: string;
  previewValue?: string;
  body: string;
  ctaLabel: string;
  bookingPrefill?: AiBookingPrefill;
};

export type AiChatTurnResult = {
  text: string;
  thinkingMs?: number;
  revealText?: boolean;
  showImagePrompt?: boolean;
  suggestion?: AiSuggestion;
  markUnavailable?: boolean;
};

export type AiChatSessionState = {
  mode: AiViewMode;
  messages: AiMessage[];
  isBotTyping: boolean;
  suggestion: AiSuggestion | null;
  showImagePrompt: boolean;
  pendingImages: AiImageAttachment[];
};
