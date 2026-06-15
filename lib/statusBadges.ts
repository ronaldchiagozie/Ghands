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
} as const;

export type JobStatusBadgeKey = keyof typeof JOB_STATUS_BADGE;
