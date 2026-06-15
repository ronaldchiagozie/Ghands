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
    description: 'Get help anywhere, anytime. Connect instantly with nearby professional',
    icon: 'location',
    image: require('../assets/images/onboarding1.png')
  },
  {
    id: 'tracking',
    title: 'Fast Response, Real-Time Track',
    description: 'Track your provider in real-time and get updates on arrival.',
    icon: 'tracking',
    image: require('../assets/images/onboarding2.png')
  },
  {
    id: 'connect',
    title: 'Safe Payments',
    description: 'Pay for rendered services securely through our in-app wallet.',
    icon: 'booking',
    image: require('../assets/images/onboarding3.png')
  }
];

// Provider Onboarding Slides
export const PROVIDER_ONBOARDING_SLIDES: SlideData[] = [
  {
    id: 'provider-demand',
    title: 'Find people who need your service',
    description: 'Get alerts customers are looking for your skills anywhere, anytime.',
    icon: 'location',
    image: require('../assets/images/Provideronboarding1.png')
  },
  {
    id: 'provider-dashboard',
    title: 'All jobs, one dashboard',
    description: 'View, track, and manage every job, past and ongoing, in one place.',
    icon: 'tracking',
    image: require('../assets/images/Provideronboarding2.png')
  },
  {
    id: 'provider-payments',
    title: 'Simple, secure payments',
    description: 'Get paid with confidence. Our in-app wallet keeps all your payments organized and safe.',
    icon: 'booking',
    image: require('../assets/images/Provideronboarding3.png')
  }
];

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
    borderLight: '#F3F4F6',
    backgroundLight: '#FFFFFF',
    backgroundGray: '#F3F4F6',
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
  },
  fonts: {
    // Heading styles
    h1: {
      fontSize: 32,
      fontWeight: 'bold' as const,
      lineHeight: 38,
      fontFamily: 'Poppins-Bold'
    },
    h2: {
      fontSize: 20,
      fontWeight: 'bold' as const,
      lineHeight: 26,
      fontFamily: 'Poppins-Bold'
    },
    h3: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
      fontFamily: 'Poppins-SemiBold'
    },
    h4: {
      fontSize: 17,
      fontWeight: '600' as const,
      lineHeight: 22,
      fontFamily: 'Poppins-SemiBold'
    },
    // Body styles
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 22,
      fontFamily: 'Poppins-Regular'
    },
    bodyMedium: {
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 20,
      fontFamily: 'Poppins-Medium'
    },
    bodySmall: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 18,
      fontFamily: 'Poppins-Regular'
    },
    bodyTiny: {
      fontSize: 11,
      fontWeight: '400' as const,
      lineHeight: 16,
      fontFamily: 'Poppins-Regular'
    },
    // Button styles
    button: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
      fontFamily: 'Poppins-SemiBold'
    },
    buttonSmall: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
      fontFamily: 'Poppins-SemiBold'
    },
    // Label styles
    label: {
      fontSize: 10,
      fontWeight: '600' as const,
      lineHeight: 14,
      fontFamily: 'Poppins-SemiBold'
    }
  }
};