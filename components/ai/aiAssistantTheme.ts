export const AI_COLORS = {
  screenBase: '#003D4D',
  drawerPanel: '#002D3A',
  drawerPanelDeep: '#001E28',
  primary: '#FFFFFF',
  accent: '#E4FF5C',
  accentInk: '#003D4D',
  overlay: 'rgba(0, 0, 0, 0.52)',
  drawerBorder: 'rgba(255, 255, 255, 0.1)',
  newChatBg: '#E4FF5C',
  newChatBorder: 'rgba(228, 255, 92, 0.5)',
  rowSurface: 'rgba(255, 255, 255, 0.07)',
  rowBorder: 'rgba(255, 255, 255, 0.1)',
  rowActive: 'rgba(228, 255, 92, 0.12)',
  rowActiveBorder: 'rgba(228, 255, 92, 0.45)',
  muted: 'rgba(255, 255, 255, 0.5)',
  subtle: 'rgba(255, 255, 255, 0.72)',
  historyOverlay: 'rgba(0, 45, 58, 0.35)',
  iconMuted: 'rgba(255, 255, 255, 0.38)',
} as const;

/** Reference-style slide menu (dark charcoal, text header, icon rows). */
export const AI_DRAWER = {
  background: '#1A1D21',
  surface: '#2A2E34',
  overlay: 'rgba(0, 0, 0, 0.48)',
  divider: 'rgba(255, 255, 255, 0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  muted: '#6B7280',
  icon: '#D1D5DB',
  accent: '#E4FF5C',
  rowActive: 'rgba(255, 255, 255, 0.06)',
  footerBtnBg: '#2F343B',
  footerBtnText: '#FFFFFF',
} as const;

export const AI_ANIMATION = {
  mascotEntranceMs: 600,
  mascotSomersaultMs: 500,
  mascotFloatMs: 3000,
  mascotFloatHalfMs: 1500,
  mascotFloatDistance: 6,
  typewriterCharMs: 80,
  typewriterCursorBlinkMs: 500,
  welcomeTransitionMs: 350,
  revealCharMs: 16,
  botTypingMinMs: 900,
  botTypingMaxMs: 1500,
  drawerSlideMs: 320,
} as const;

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
  primary: AI_COLORS.primary,
  placeholder: 'rgba(255, 255, 255, 0.55)',
  cardIcon: '#F59E0B',
} as const;

export function buildAiGreeting(botName: string): string {
  const name = botName.trim() || 'Handy';
  return `Hello, how can ${name} help you today?`;
}

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

/** @deprecated Use buildAiGreeting(botName) */
export const AI_GREETING = 'Hello, How may i help you?';
