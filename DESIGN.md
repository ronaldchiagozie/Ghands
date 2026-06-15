---
name: GHands
description: Trusted local services — sage olive mobile product UI for homeowners and service requesters
colors:
  sage-accent: "#4F6739"
  sage-panel-border: "rgba(45, 65, 24, 0.75)"
  soft-warm: "#F5F0E8"
  background-dark: "#0B0B07"
  surface-white: "#FFFFFF"
  surface-gray: "#F3F4F6"
  text-primary: "#000000"
  text-secondary: "#666666"
  text-tertiary: "#999999"
  border-default: "#E5E7EB"
  success: "#166534"
  success-light: "rgba(79, 103, 57, 0.14)"
  warning: "#F59E0B"
  error: "#DC2626"
  tab-inactive: "#9CA3AF"
  tablet-backdrop: "#242420"
typography:
  display:
    fontFamily: "Poppins-Bold"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.19
  headline:
    fontFamily: "Poppins-Bold"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Poppins-SemiBold"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.33
  body:
    fontFamily: "Poppins-Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "Poppins-SemiBold"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "10px"
  default: "12px"
  lg: "16px"
  sage-hero: "16px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  xxxl: "32px"
  screen-horizontal: "20px"
components:
  button-primary:
    backgroundColor: "{colors.sage-accent}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.default}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.default}"
    padding: "0 16px"
    height: "48px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.sage-accent}"
    rounded: "{rounded.default}"
    padding: "0 16px"
    height: "48px"
  card-default:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.default}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.surface-gray}"
    rounded: "{rounded.default}"
    padding: "6px 12px"
    height: "44px"
---

# Design System: GHands

## 1. Overview

**Creative North Star: "The Trusted Neighbor"**

GHands is a mobile product surface — not a marketing site. The interface should feel like a capable local service app: warm light content areas, sage olive brand moments on hero panels and primary actions, and Poppins typography tuned for legibility at arm's length. Density is comfortable, not sparse; hierarchy comes from type weight and spacing, not decorative chrome.

The system explicitly rejects AI-generated slop: no purple gradients, no glassmorphism, no card-on-card nesting, no pure black backgrounds, and no decorative motion. Depth is conveyed through borders and subtle iOS shadows — Android stays flat by design.

**Key Characteristics:**

- Sage olive (`#4F6739`) as the sole brand accent — tabs, CTAs, hero panels, status chrome
- Poppins across all roles; bold for headings, regular/medium for body and labels
- Warm neutrals (`#F5F0E8`, `#F3F4F6`) instead of cold gray UI fills
- Flat Android elevation; restrained iOS shadows via `SURFACE_STYLES`
- 20px horizontal screen gutter; 12–24px vertical rhythm between sections
- React Native + NativeWind; tokens live in `lib/assets.ts` and `lib/designSystem.ts`

## 2. Colors

A grounded, nature-inspired palette anchored on sage olive with warm paper neutrals.

### Primary

- **Sage Olive** (`#4F6739`): Primary actions, active tab tint, hero panels (home quick actions, wallet, profile), splash/status bar chrome, notification accent. The brand voice color — use deliberately, not as wallpaper.
- **Sage Panel Border** (`rgba(45, 65, 24, 0.75)`): Depth edge on sage hero cards without heavy shadows.

### Neutral

- **Soft Warm** (`#F5F0E8`): Secondary text on dark panels, warm tint for readable copy on sage backgrounds.
- **Surface White** (`#FFFFFF`): Primary content cards, category chips, form surfaces on light screens.
- **Surface Gray** (`#F3F4F6`): Input field backgrounds, subtle wells and dividers.
- **Border Default** (`#E5E7EB`): Outlined cards, hairline separators.
- **Text Primary** (`#000000`): Body copy on light surfaces.
- **Text Secondary** (`#666666`): Supporting labels, metadata.
- **Text Tertiary** (`#999999`): Placeholder-adjacent, de-emphasized copy.
- **Background Dark** (`#0B0B07`): Deep backdrop for dark-mode-adjacent contexts.
- **Tablet Backdrop** (`#242420`): Outer margin on tablet "phone lane" framing.

### Semantic

- **Success** (`#166534`) / **Success Light** (`rgba(79, 103, 57, 0.14)`): Completed jobs, in-progress badges.
- **Warning** (`#F59E0B`): Pending payment, attention-needed states.
- **Error** (`#DC2626`): Form validation, failed actions.

### Named Rules

**The Sage Signal Rule.** Sage accent appears on primary CTAs, active navigation, and intentional hero panels — never as a full-screen wash on data-heavy screens.

**The Warm Neutral Rule.** Prefer `#F3F4F6` and `#F5F0E8` over cold `#F9FAFB` grays. The app should feel local and human, not clinical.

## 3. Typography

**Display / Headline / Title / Body / Label Font:** Poppins (Bold, SemiBold, Regular, Medium variants loaded via `@expo-google-fonts/poppins`)

**Character:** Friendly geometric sans — rounded, approachable, readable at mobile sizes. One family throughout; weight and size carry hierarchy.

### Hierarchy

- **Display** (Bold, 32px / 38px line): Screen titles, onboarding headlines.
- **Headline** (Bold, 20px / 26px line): Section headers on home and job screens.
- **Title** (SemiBold, 18px / 24px line): Card titles, modal headers.
- **Body** (Regular, 16px / 22px line): Primary readable content; keep lines concise on narrow screens.
- **Body Medium** (Medium, 14px / 20px line): Secondary content, list subtitles.
- **Label** (SemiBold, 10–12px): Badges, tab labels, button text (buttons use 11–12px SemiBold).

### Named Rules

**The One Family Rule.** Do not introduce Inter, system UI, or display serifs for UI chrome. Poppins only.

## 4. Elevation

GHands uses **tonal layering and borders first, shadows second**. Android explicitly disables material elevation (`surfaceElevation` returns 0 on Android). iOS uses restrained shadows defined in `SURFACE_STYLES`.

### Shadow Vocabulary (iOS only)

- **Home tile** (`shadowOpacity: 0.05`, `shadowRadius: 4`): Category chips, light tiles.
- **Home card** (`border: 1px rgba(17,24,39,0.12)`, `shadowOpacity: 0.04`): List cards with hairline border + whisper shadow.
- **Search field** (`shadowOpacity: 0.04`, `shadowRadius: 3`): Floating search inputs.

Legacy `SHADOWS` scale in `designSystem.ts` is zeroed out — do not reintroduce heavy drop shadows.

### Named Rules

**The Flat Android Rule.** Never add `elevation` on Android for decorative depth. Use borders and background contrast instead.

**The Hairline Over Shadow Rule.** Prefer `borderColor: rgba(17, 24, 39, 0.055–0.12)` over dark box shadows for card separation.

## 5. Components

### Buttons (`components/ui/Button.tsx`)

- **Shape:** 12px radius (`BorderRadius.default`); heights 40 / 48 / 56px by size.
- **Primary:** Sage background, white text, no border.
- **Secondary:** Black background, white text.
- **Outline:** Transparent fill, 2px sage border, sage text.
- **Ghost / Danger:** Transparent or `#DC2626` for destructive actions.
- **States:** 0.5 opacity when disabled; loading shows `ActivityIndicator`.

### Cards (`components/ui/Card.tsx`)

- **Corner Style:** 12px default; 16px for hero panels (`sageHero`).
- **Variants:** default (light shadow), elevated, outlined (1px `#E5E7EB`), flat.
- **Padding:** 12 / 16 / 24px by prop.

### Inputs (`components/InputField.tsx`)

- **Style:** `#F3F4F6` fill, 12px radius, 44px min height, left/right icon slots.
- **Focus:** 2px sage border.
- **Error:** 2px red border + error message below.
- **Password:** Toggle visibility with Eye/EyeOff icons.

### Navigation

- **Tab bar:** Sage active tint (`#4F6739`), gray inactive (`#9CA3AF`), Expo Router bottom tabs.
- **Screen headers:** `ScreenHeader` / `HeaderComponent` with back affordance and consistent horizontal padding (20px).

### Home Hero Panels

- Sage panel background (`#4F6739`) with frosted white tiles (`rgba(255,255,255,0.16)`) for quick actions — not pure white tiles on sage.

### Chips & Badges

- `TagBadge`, `AnimatedStatusChip`: success-light sage tint backgrounds with `#2A3B1F` foreground for readable green-on-tint.

## 6. Do's and Don'ts

### Do:

- **Do** import colors, spacing, and typography from `@/lib/designSystem` — never hardcode one-off hex values when a token exists.
- **Do** use `SURFACE_STYLES` for card and search field elevation on iOS.
- **Do** keep primary sage CTAs to one per screen section.
- **Do** provide skeleton loaders (`LoadingSkeleton`) and empty states (`EmptyState`, `JobsTabEmptyState`) for async content.
- **Do** use 200–300ms animation durations (`ANIMATION_DURATION`) for state feedback; respect reduced motion preferences.

### Don't:

- **Don't** use generic AI SaaS aesthetics — purple gradients, glassmorphism, neon accents, or Inter/Arial as UI fonts.
- **Don't** nest cards inside cards without clear hierarchy; one container level per content block.
- **Don't** add heavy Android elevation or dark drop shadows — the system is intentionally flat on Android.
- **Don't** use pure black backgrounds or untinted cold grays for large surface areas.
- **Don't** use bounce or elastic easing; stick to standard ease curves for mobile feedback.
- **Don't** invent custom affordances when standard tabs, lists, and form patterns already exist in the codebase.
