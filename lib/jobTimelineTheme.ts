import { providerHomeSurfacePadding } from './providerSurfaceStyles';

/** Vertical job progress timeline — sage olive for “done”, warm gold for “active”, calm neutrals for pending. */
export const JOB_TIMELINE = {
  sage: '#4F6739',
  completeSoft: 'rgba(79, 103, 57, 0.1)',
  sageChipText: '#2A3B1F',

  activeDot: '#C9A227',
  activeSoft: 'rgba(245, 158, 11, 0.12)',
  activeChipText: '#6B530E',

  infoSoft: 'rgba(37, 99, 235, 0.12)',
  infoChipText: '#1E3A8A',

  pendingDot: '#B8C4CE',
  pendingSoft: 'rgba(148, 163, 184, 0.18)',
  pendingChipText: '#5C6674',
  pendingDotFill: '#F3F4F6',
  pendingDotBorder: '#E5E7EB',

  declinedDot: '#DC2626',
  declinedSoft: '#FEE2E2',
  declinedChipText: '#991B1B',

  railIdle: 'rgba(79, 103, 57, 0.12)',
  railMuted: 'rgba(148, 163, 184, 0.32)',
  railPending: '#E5E7EB',

  panelBorder: '#E5E7EB',
  panelDivider: '#E5E7EB',
  progressLabel: '#666666',
  titleText: '#000000',
  metaText: '#666666',
  roleText: '#767676',
  iconMuted: '#767676',

  timestampCompleted: '#767676',
  timestampActive: '#B45309',
  timestampDeclined: '#991B1B',
  timestampSkipped: '#5C6674',
  timestampPending: '#767676',

  badgeCompletedBg: 'rgba(79, 103, 57, 0.1)',
  badgeCompletedText: '#2A3B1F',
  badgeActiveBg: 'rgba(245, 158, 11, 0.12)',
  badgeActiveText: '#6B530E',
  badgeDeclinedBg: '#FEE2E2',
  badgeDeclinedText: '#991B1B',
  badgeSkippedBg: 'rgba(148, 163, 184, 0.18)',
  badgeSkippedText: '#5C6674',

  sageOutlineBg: '#F2F8EA',
  sageOutlineBorder: 'rgba(79, 103, 57, 0.16)',

  rowBg: '#FAFBF9',
  rowBorder: 'rgba(45, 65, 24, 0.09)',

  dotShadow: '#1a2414',
  dotInactiveFill: '#F3F4F6',
} as const;

export const JOB_TIMELINE_LAYOUT = {
  dotSize: 26,
  dotRadius: 13,
  dotIconActive: 14,
  dotIconPending: 12,
  sectionPaddingH: providerHomeSurfacePadding,
  sectionPaddingV: 12,
  rowMarginBottom: 10,
  connectorWidth: 2,
  connectorMinHeight: 30,
  connectorMarginTop: 6,
} as const;

export type TimelineStepPhase = 'completed' | 'active' | 'pending' | 'declined' | 'skipped';

export function timelineStepPhase(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
}): TimelineStepPhase {
  if (step.isDeclined) return 'declined';
  if (step.isSkipped) return 'skipped';
  if (step.isCompleted) return 'completed';
  if (step.isActive) return 'active';
  return 'pending';
}

export function timelineConnectorColor(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
  lineColor?: string;
}): string {
  const phase = timelineStepPhase(step);
  if (step.lineColor) return step.lineColor;
  if (phase === 'completed') return JOB_TIMELINE.sage;
  if (phase === 'active' || phase === 'declined') return step.isDeclined ? JOB_TIMELINE.declinedDot : JOB_TIMELINE.activeDot;
  if (phase === 'skipped') return JOB_TIMELINE.railPending;
  return JOB_TIMELINE.railPending;
}

export function timelineDotFill(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
  dotColor?: string;
}): string {
  if (step.dotColor) return step.dotColor;
  const phase = timelineStepPhase(step);
  if (phase === 'completed') return JOB_TIMELINE.sage;
  if (phase === 'active') return JOB_TIMELINE.activeDot;
  if (phase === 'declined') return JOB_TIMELINE.declinedDot;
  if (phase === 'skipped') return JOB_TIMELINE.pendingDotFill;
  return JOB_TIMELINE.pendingDotFill;
}

export function timelineStatusTimestampColor(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
}): string {
  const phase = timelineStepPhase(step);
  if (phase === 'completed') return JOB_TIMELINE.timestampCompleted;
  if (phase === 'active') return JOB_TIMELINE.timestampActive;
  if (phase === 'declined') return JOB_TIMELINE.timestampDeclined;
  if (phase === 'skipped') return JOB_TIMELINE.timestampSkipped;
  return JOB_TIMELINE.timestampPending;
}

export function timelineBadgeForStep(step: {
  isCompleted?: boolean;
  isActive?: boolean;
  isDeclined?: boolean;
  isSkipped?: boolean;
}): { label: string; bg: string; text: string } | null {
  const phase = timelineStepPhase(step);
  if (phase === 'completed') {
    return { label: 'Done', bg: JOB_TIMELINE.badgeCompletedBg, text: JOB_TIMELINE.badgeCompletedText };
  }
  if (phase === 'active') {
    return { label: 'Active', bg: JOB_TIMELINE.badgeActiveBg, text: JOB_TIMELINE.badgeActiveText };
  }
  if (phase === 'declined') {
    return { label: 'Declined', bg: JOB_TIMELINE.badgeDeclinedBg, text: JOB_TIMELINE.badgeDeclinedText };
  }
  if (phase === 'skipped') {
    return { label: 'Skipped', bg: JOB_TIMELINE.badgeSkippedBg, text: JOB_TIMELINE.badgeSkippedText };
  }
  return null;
}

export function timelineChipText(step: { isCompleted?: boolean; isActive?: boolean; isDeclined?: boolean; isSkipped?: boolean }): string {
  if (step.isCompleted) return JOB_TIMELINE.sageChipText;
  if (step.isDeclined) return JOB_TIMELINE.declinedChipText;
  if (step.isSkipped) return JOB_TIMELINE.pendingChipText;
  if (step.isActive) return JOB_TIMELINE.activeChipText;
  return JOB_TIMELINE.pendingChipText;
}

export function timelineDotColor(step: { isCompleted?: boolean; isActive?: boolean; isPending?: boolean; isDeclined?: boolean }) {
  if (step.isCompleted) return JOB_TIMELINE.sage;
  if (step.isDeclined) return JOB_TIMELINE.declinedDot;
  if (step.isActive) return JOB_TIMELINE.activeDot;
  return JOB_TIMELINE.pendingDot;
}

export function timelineLineColor(step: { isCompleted?: boolean; isActive?: boolean; isPending?: boolean; isDeclined?: boolean }) {
  if (step.isCompleted) return JOB_TIMELINE.sage;
  if (step.isDeclined) return JOB_TIMELINE.declinedDot;
  if (step.isActive) return JOB_TIMELINE.activeDot;
  return JOB_TIMELINE.railMuted;
}

export function timelineAccentBg(step: { isCompleted?: boolean; isActive?: boolean; isPending?: boolean; isDeclined?: boolean }) {
  if (step.isCompleted) return JOB_TIMELINE.completeSoft;
  if (step.isDeclined) return JOB_TIMELINE.declinedSoft;
  if (step.isActive) return JOB_TIMELINE.activeSoft;
  return JOB_TIMELINE.pendingSoft;
}
