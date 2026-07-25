import type { AiBookingPrefill, AiChatTurnResult, AiMessage } from './types';
import { normalizeCategoryName } from '@/utils/categoryMapping';
import { summarizeJobDescription } from '@/utils/jobDescriptionSummary';

const PLUMBER_BOOKING_DRAFT =
  'Urgent bathroom pipe leak with water gushing out. Main water valve is shut off. Need a plumber to inspect and repair the leak as soon as possible.';

const BOOKING_DRAFT =
  'Bathroom pipe is leaking badly with water gushing out. Main valve is off. Need an urgent plumber visit to inspect and repair the burst section.';

const BOOKING_DETAILS_PROMPT = 'Want me to suggest booking details you can use?';
const PHOTO_ANALYSIS_PROMPT = 'share photos so I can review the issue';

function lastAssistantMessage(messages: AiMessage[]): AiMessage | undefined {
  return [...messages].reverse().find((m) => m.role === 'assistant');
}

function mentionsBooking(text: string): boolean {
  return /\b(book(ing)? a job|want to book|book a service)\b/i.test(text);
}

function mentionsSinkIssue(text: string): boolean {
  return /\b(sink|drain|gurgling|plumb|pipe|water|flood|gush)\b/i.test(text);
}

function mentionsCost(text: string): boolean {
  return /\b(cost|price|how much|₦|n\d|ac|air.?condition|1\.5hp|hp)\b/i.test(text);
}

function isAffirmative(text: string): boolean {
  return /^(yes|yeah|yep|sure|ok(ay)?|please|yes please)\.?$/i.test(text.trim());
}

function mentionsDraftHelp(text: string): boolean {
  return /\b(explain|how do i|write|draft|word|message|describe)\b/i.test(text);
}

function mentionsThanks(text: string): boolean {
  return /\b(thank|thanks|appreciate)\b/i.test(text);
}

function conversationContext(messages: AiMessage[]): string {
  return messages.map((message) => message.text).join(' ').toLowerCase();
}

function plumbingBookingPrefill(description: string, jobTitle = 'Urgent plumbing repair'): AiBookingPrefill {
  return {
    categoryName: normalizeCategoryName('plumbing') || 'plumbing',
    jobTitle,
    description: summarizeJobDescription(description, { jobTitle, maxLength: 120, maxSentences: 2 }),
  };
}

function acBookingPrefill(description: string, jobTitle = 'AC service request'): AiBookingPrefill {
  return {
    categoryName: normalizeCategoryName('air conditioning') || 'airConditioning',
    jobTitle,
    description: summarizeJobDescription(description, { jobTitle, maxLength: 120, maxSentences: 2 }),
  };
}

export function resolvePostImageAnalysisTurn(messages: AiMessage[]): AiChatTurnResult {
  const context = conversationContext(messages);

  if (/\bac|air.?condition|1\.5hp|hp\b/.test(context)) {
    return {
      text: 'I can see the photos. This looks like an AC issue. Here are booking details you can use.',
      thinkingMs: 1200,
      revealText: true,
      suggestion: {
        id: `suggestion-${Date.now()}`,
        variant: 'draft',
        title: 'Suggestion',
        body: 'AC issue with photos attached. Provider can review before the service visit. Please schedule at your earliest convenience.',
        ctaLabel: 'Use draft',
        bookingPrefill: acBookingPrefill(
          'Air conditioner issue with photos attached for diagnosis before the service visit.'
        ),
      },
    };
  }

  return {
    text: 'I can see the photos. I will use them to refine the category and next steps for your booking.',
    thinkingMs: 1200,
    revealText: true,
    suggestion: {
      id: `suggestion-${Date.now()}`,
      variant: 'draft',
      title: 'Suggestion',
      body: PLUMBER_BOOKING_DRAFT,
      ctaLabel: 'Use draft',
      bookingPrefill: plumbingBookingPrefill(PLUMBER_BOOKING_DRAFT),
    },
  };
}

export function resolveAiChatTurn(
  userText: string,
  messages: AiMessage[],
  issueLabel = 'service'
): AiChatTurnResult {
  const lower = userText.toLowerCase().trim();
  const prevAssistant = lastAssistantMessage(messages);

  if (lower === '__bot_unavailable__') {
    return { text: '', markUnavailable: true };
  }

  if (mentionsThanks(lower)) {
    return {
      text: "You're welcome. Anything else I can help with?",
      thinkingMs: 900,
      revealText: true,
    };
  }

  if (isAffirmative(lower) && prevAssistant?.text.includes(BOOKING_DETAILS_PROMPT)) {
    return {
      text: '',
      thinkingMs: 1100,
      suggestion: {
        id: `suggestion-${Date.now()}`,
        variant: 'draft',
        title: 'Suggestion',
        body: PLUMBER_BOOKING_DRAFT,
        ctaLabel: 'Use draft',
        bookingPrefill: plumbingBookingPrefill(PLUMBER_BOOKING_DRAFT),
      },
    };
  }

  if (isAffirmative(lower) && prevAssistant?.text.toLowerCase().includes(PHOTO_ANALYSIS_PROMPT)) {
    return {
      text: 'I can see the photos. I will use them to refine the category and next steps for your booking.',
      thinkingMs: 1200,
      revealText: true,
    };
  }

  if (mentionsDraftHelp(lower) && mentionsSinkIssue(lower)) {
    const body = /\bplumb|booking|explain\b/i.test(lower)
      ? PLUMBER_BOOKING_DRAFT
      : BOOKING_DRAFT;
    return {
      text: 'Try this wording:',
      thinkingMs: 1000,
      revealText: true,
      suggestion: {
        id: `suggestion-${Date.now()}`,
        variant: 'draft',
        title: 'Suggestion',
        body,
        ctaLabel: 'Use draft',
        bookingPrefill: plumbingBookingPrefill(body),
      },
    };
  }

  if (mentionsCost(lower)) {
    return {
      text:
        'For a standard 1.5HP AC service in Lagos, expect roughly ₦8,000 to ₦12,000 depending on gas level, cleaning, and parts. This is an estimate. Your provider quote may differ.',
      thinkingMs: 1400,
      revealText: true,
    };
  }

  if (/\b(gush|burst|emergency|flooding)\b/i.test(lower)) {
    return {
      text:
        `This sounds urgent. Turn your main water valve clockwise to limit flooding while you wait. ${BOOKING_DETAILS_PROMPT}`,
      thinkingMs: 1500,
      revealText: true,
    };
  }

  if (mentionsBooking(lower)) {
    return {
      text: 'Describe the issue in detail and I will help you book the right service.',
      thinkingMs: 1000,
      revealText: true,
    };
  }

  if (mentionsSinkIssue(lower) || /\bac|air.?condition|1\.5hp\b/i.test(lower)) {
    const label =
      /\bac|air.?condition|1\.5hp\b/i.test(lower) ? 'Air Conditioner' : issueLabel;
    return {
      text: `Sounds like a ${label} issue. ${PHOTO_ANALYSIS_PROMPT.charAt(0).toUpperCase()}${PHOTO_ANALYSIS_PROMPT.slice(1)}?`,
      thinkingMs: 1100,
      revealText: true,
      showImagePrompt: true,
    };
  }

  return {
    text:
      'I can help with booking, cost estimates, message drafts, and photo review. Tell me what you need.',
    thinkingMs: 900,
    revealText: true,
  };
}
