import { DESIGN_TOKENS } from './assets';

const Colors = DESIGN_TOKENS.colors;

/** Shared job / activity status badge colors — use with AnimatedStatusChip or inline badges. */
export const JOB_STATUS_BADGE = {
  completed: {
    bg: Colors.successLight,
    text: Colors.successForeground,
  },
  inProgress: {
    bg: Colors.infoSoft,
    text: Colors.infoDark,
  },
  pending: {
    bg: Colors.statusPendingBg,
    text: Colors.statusPendingText,
  },
  pendingAlt: {
    bg: Colors.statusPendingAltBg,
    text: Colors.warningForeground,
  },
  cancelled: {
    bg: Colors.backgroundGray,
    text: Colors.iconMuted,
  },
  rejected: {
    bg: Colors.errorBorder,
    text: Colors.errorForeground,
  },
  accepted: {
    bg: Colors.infoSoft,
    text: Colors.infoDark,
  },
  inspecting: {
    bg: Colors.statusPendingAltBg,
    text: Colors.warningForeground,
  },
  quoting: {
    bg: 'rgba(59, 130, 246, 0.12)',
    text: '#1D4ED8',
  },
  scheduled: {
    bg: Colors.successLight,
    text: Colors.successForeground,
  },
  reviewing: {
    bg: 'rgba(245, 158, 11, 0.14)',
    text: '#B45309',
  },
  noProviders: {
    bg: Colors.errorBorder,
    text: Colors.errorForeground,
  },
} as const;

export type JobStatusBadgeKey = keyof typeof JOB_STATUS_BADGE;
