export const AI_ASSISTANT_GRADIENT = {
  colors: ['#003D4D', '#00C996'] as const,
  locations: [0.0241, 0.9759] as const,
  start: { x: 0.48, y: 0 },
  end: { x: 0.52, y: 1 },
} as const;

export const AI_ASSISTANT_OVERLAY = 'rgba(0, 0, 0, 0.2)';

export const AI_ASSISTANT_GLASS = {
  background: 'rgba(255, 255, 255, 0.14)',
  border: 'rgba(255, 255, 255, 0.5)',
  inputBackground: 'rgba(0, 45, 58, 0.42)',
} as const;

/** Solid emerald cards on the AI home carousel (ref design). */
export const AI_QUICK_ACTION_CARD = {
  background: '#0F8568',
  border: '#FFFFFF',
  borderWidth: 1,
  borderRadius: 14,
} as const;

/** Carousel pagination track below quick-action cards. */
export const AI_CAROUSEL_PAGINATION = {
  trackHeight: 2,
  trackColor: 'rgba(255, 255, 255, 0.28)',
  indicatorColor: '#E4FF5C',
  marginTop: 14,
} as const;

export const AI_ASSISTANT_TEXT = {
  primary: '#FFFFFF',
  placeholder: 'rgba(255, 255, 255, 0.55)',
  cardIcon: '#F59E0B',
} as const;

export const AI_GREETING = 'Hello, How may i help you?';

export type AiQuickAction = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  promptSeed: string;
};

export const AI_QUICK_ACTIONS: AiQuickAction[] = [
  {
    id: 'find-artisan',
    emoji: '💼',
    title: 'Find an artisan',
    description:
      'Explain your problem and I will help you choose the right category and specialist for the job.',
    promptSeed: 'I need help finding the right artisan for a job. ',
  },
  {
    id: 'smart-draft',
    emoji: '📋',
    title: 'Smart Draft',
    description: 'Get suggestions for your writeups',
    promptSeed: 'Help me draft a professional message. ',
  },
];
