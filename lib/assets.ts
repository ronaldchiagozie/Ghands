export interface SlideData {
  id: string;
  title: string;
  description: string;
  icon: 'location' | 'tracking' | 'booking';
  image: any; 
}

// Client Onboarding Slides
export const ONBOARDING_SLIDES: SlideData[] = [
  {
    id: 'map',
    title: 'Find Trusted Experts Near You',
    description: 'Get help fast from professionals a few streets away.',
    icon: 'location',
    image: require('../assets/images/onboarding1.png')
  },
  {
    id: 'tracking',
    title: 'Fast Response, Real-Time Tracking',
    description: 'Track your provider in real-time and get updates on arrival.',
    icon: 'tracking',
    image: require('../assets/images/onboarding2.png')
  },
  {
    id: 'connect',
    title: 'Escrow Protected Payments',
    description: 'Your money is held safely until the job is done right.',
    icon: 'booking',
    image: require('../assets/images/onboarding3.png')
  }
];

/** Offline overlay — man with phone, no Wi‑Fi (`assets/images/nointernetimg.png`). */
export const NO_INTERNET_ILLUSTRATION = require('../assets/images/nointernetimg.png');

export const DESIGN_TOKENS = {
  colors: {
    // Primary colors — sage olive (panels, brand actions, tabs)
    background: '#0b0b07',
    accent: '#4F6739',
    /** Border / depth for sage hero cards (profile, wallet, dashboard) */
    sagePanelBorder: 'rgba(45, 65, 24, 0.75)',
    softWarm: '#F5F0E8',
    white: '#FFFFFF',
    black: '#000000',
    
    // Text colors
    text: '#FFFFFF',
    textSecondary: '#F5F0E8',
    textPrimary: '#000000',
    textSecondaryDark: '#666666',
    /** Input placeholders — ≥4.5:1 on white and backgroundGray. Do not use textTertiary for placeholders. */
    placeholder: '#666666',
    textTertiary: '#999999',
    
    // UI colors
    border: '#E5E7EB',
    /** Second border weight — control rings (radio/checkbox), dashed dropzones, disabled outlines, where `border` is too faint. */
    borderStrong: '#D1D5DB',
    borderLight: '#F3F4F6',
    backgroundLight: '#FFFFFF',
    backgroundGray: '#F3F4F6',
    /** Subtle surface fill, one step lighter than backgroundGray — inset rows and placeholder wells. */
    surfaceSubtle: '#F9FAFB',
    /** Dimming layer behind centred modals. */
    overlayScrim: 'rgba(0, 0, 0, 0.45)',
    /** Outer margin on tablet “phone lane” — contrasts with backgroundLight inside the lane */
    tabletBackdrop: '#242420',
    
    // Status colors
    success: '#166534',
    /** Light sage tint for success / in-progress badges */
    successLight: 'rgba(79, 103, 57, 0.14)',
    /** Readable green on successLight backgrounds */
    successForeground: '#2A3B1F',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#DC2626',
    errorLight: '#FEF2F2',
    errorBorder: '#FEE2E2',
    /** Form validation and alert red (Tailwind red-500) */
    errorBright: '#EF4444',
    /** Readable red on errorLight / badge backgrounds */
    errorForeground: '#991B1B',
    /** Translucent red badge fill */
    errorBadge: 'rgba(239, 68, 68, 0.14)',
    /** Readable amber on warningLight / badge backgrounds */
    warningForeground: '#92400E',
    /** Translucent amber badge fill */
    warningBadge: 'rgba(245, 158, 11, 0.18)',
    
    // Semantic surfaces & tints
    /** Sage-tinted chip / pill background */
    sageTint: '#F2F8EA',
    /** Soft sage empty-state surface */
    sageSurface: '#F8FAF7',
    /** Dark hero panels and banners */
    surfaceDark: '#111827',
    /** Sage-tinted border on white cards */
    borderSage: '#E8EBE5',
    
    // Neutral text & icons
    /** Muted icon and secondary meta (gray-500) */
    iconMuted: '#6B7280',
    /** Body meta on light surfaces (gray-600) */
    textMuted: '#4B5563',
    /** Dark neutral icons (gray-800) */
    inkMuted: '#1F2937',
    
    // Info / in-progress (blue family)
    /** Soft blue badge background (in-progress jobs) */
    infoSoft: '#E4ECFF',
    /** Notification info icon background */
    infoLight: '#DBEAFE',
    /** Info icon accent */
    info: '#1D4ED8',
    /** In-progress badge text */
    infoDark: '#2750B8',
    
    /** Rich green icons on sage tints */
    successIcon: '#15803D',
    
    // Job status badge fills
    /** Warm pending badge background */
    statusPendingBg: '#FFF4E0',
    statusPendingText: '#9E6B1F',
    /** Yellow pending chip (jobs tab) */
    statusPendingAltBg: '#FEF9C3',
    
    /** Rating star fill */
    star: '#FACC15',
    tabActive: '#4F6739',
    tabInactive: '#9CA3AF',
    
    // Shadow
    shadow: '#000000',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48
  },
  borderRadius: {
    sm: 8,
    md: 10,
    default: 12,
    lg: 16,
    xl: 18,
    /** Sage wallet / earnings / profile hero panels — one consistent corner across the app */
    sageHero: 16,
    full: 999
  }
  // No `fonts` scale: type is written inline as fontSize + `Poppins-*`.
  // See .cursor/rules/ui-scale-and-tablet.mdc for the roles and sizes in use.
};