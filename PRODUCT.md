# Product

## Register

product

## Users

Homeowners and service requesters who need trusted local professionals for home and personal services. They use GHands on mobile (iOS/Android) while managing real-world tasks: finding providers, booking visits, tracking job progress, paying through an in-app wallet, and communicating with providers.

Context is often on-the-go — quick glances between errands, one-handed use, and occasional poor connectivity. Users expect familiar mobile patterns, not marketing theatrics.

## Product Purpose

GHands connects people who need services with nearby verified providers. The client app helps users discover categories, request service, track jobs in real time, manage payments securely, and stay informed through notifications and in-app support.

Success looks like: a user can find help fast, understand job status at a glance, pay with confidence, and return without re-learning the interface.

## Brand Personality

Trustworthy, grounded, and calm. GHands should feel like a reliable local service partner — professional without being corporate, warm without being playful. The sage olive palette signals nature, stability, and local expertise.

Three words: **trusted**, **clear**, **capable**.

## Anti-references

- Generic AI SaaS landing-page aesthetics (purple gradients, glassmorphism, neon accents)
- Over-decorated buttons, mismatched form controls, or display fonts in UI labels
- Card grids stacked on card grids with no hierarchy
- Pure black (#000) or untinted gray surfaces without warmth
- Bounce/elastic easing and decorative motion that doesn't convey state
- Modal-first flows where inline or progressive disclosure would work
- Inter, Arial, or system-default typography when the project already defines Poppins

## Design Principles

1. **Earned familiarity** — Use standard mobile affordances (tabs, lists, chips, forms) so users trust the interface immediately.
2. **Task over decoration** — Every screen should help someone finish a job; visual flair serves clarity, not spectacle.
3. **Sage as signal** — Brand green marks primary actions, active tabs, and hero panels; it is rare enough to mean something.
4. **Warm, readable surfaces** — Light content areas use warm neutrals; dark sage panels carry brand moments without overwhelming data.
5. **State completeness** — Loading, empty, error, and success states are first-class; never ship a half-finished interaction.

## Accessibility & Inclusion

- Target WCAG 2.1 AA contrast for text and interactive elements where feasible on mobile
- Respect `prefers-reduced-motion` (already supported via onboarding and animation hooks)
- Minimum touch targets ~44pt; form fields use defined input heights (44–60px)
- Support automatic light/dark UI style at the OS level where applicable
- Clear error messaging on form fields; haptic feedback for key confirmations
