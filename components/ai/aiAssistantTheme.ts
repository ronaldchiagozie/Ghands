export const AI_COLORS = {
  screenBase: '#003D4D',
  drawerPanel: '#002D3A',
  drawerPanelDeep: '#001E28',
  primary: '#FFFFFF',
  accent: '#E4FF5C',
  accentInk: '#003D4D',
  /** Teal neon green (gradient end) — use instead of lemon for readable accents on dark. */
  neonGreen: '#00C996',
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

/** Chat bubbles, typing indicator, suggestions — no neon/lemon on white surfaces. */
export const AI_CHAT_UI = {
  /** Grayscale typing dots (left → right: medium, light, dark) inside white pill bubble. */
  typingDots: ['#9CA3AF', '#D1D5DB', '#1F2937'] as const,
  typingBubble: {
    background: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minWidth: 80,
  },
  /** @deprecated Use typingDots */
  typingDot: '#9CA3AF',
  typingDotDim: '#D1D5DB',
  /** Full-screen / overlay loaders on the teal gradient */
  spinnerOnGradient: '#FFFFFF',
  suggestion: {
    surface: '#FFFFFF',
    title: '#111827',
    body: '#374151',
    previewLabel: '#1F2937',
    previewBg: '#F8FAF7',
    previewBorder: '#E5E7EB',
    /** Black pill + neon green label (not lemon). */
    ctaBg: '#111827',
    ctaText: AI_COLORS.neonGreen,
    footerIcon: 'rgba(255, 255, 255, 0.78)',
  },
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

export type AiQuickActionIcon = 'service' | 'describe';

export type AiQuickAction = {
  id: string;
  icon: AiQuickActionIcon;
  title: string;
  description: string;
  promptSeed: string;
};

export const AI_QUICK_ACTIONS: AiQuickAction[] = [
  {
    id: 'find-service',
    icon: 'service',
    title: 'What service do I need?',
    description: 'Describe your issue and Handy will suggest the right category.',
    promptSeed: 'I need help figuring out which service category fits my problem. ',
  },
  {
    id: 'describe-job',
    icon: 'describe',
    title: 'Help describe my job',
    description: 'Draft clear details so providers can quote accurately.',
    promptSeed: 'Help me describe my job clearly for providers. ',
  },
];

/** @deprecated Use buildAiGreeting(botName) */
export const AI_GREETING = 'Hello, how can Handy help you today?';
