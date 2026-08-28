import React from 'react';
import { View } from 'react-native';
import {
  BriefcaseBusiness,
  ClipboardCheck,
  ClockFading,
  FileText,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';

import { Colors } from '@/lib/designSystem';

export type JobsEmptyVariant = 'pending' | 'ongoing' | 'completed' | 'cancelled' | 'quotations';

/**
 * Empty-state mark: one icon, one soft disc, nothing else.
 *
 * The previous illustrations were bespoke SVGs stacking a halo, a dashed orbit
 * ring, a drawn briefcase and a floating tick — the visual signature of stock
 * "empty state" art, and out of step with the Lucide set the rest of the app
 * uses. A single well-chosen icon reads as considered; a scene reads as filler.
 */
const VARIANT_ICON: Record<JobsEmptyVariant, LucideIcon> = {
  pending: ClockFading,
  ongoing: BriefcaseBusiness,
  completed: ClipboardCheck,
  cancelled: XCircle,
  quotations: FileText,
};

export function JobsEmptyIllustration({
  variant,
  size = 96,
}: {
  variant: JobsEmptyVariant;
  size?: number;
}) {
  const Icon = VARIANT_ICON[variant] ?? BriefcaseBusiness;
  const isCancelled = variant === 'cancelled';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isCancelled ? 'rgba(220, 38, 38, 0.07)' : Colors.successLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        size={Math.round(size * 0.4)}
        color={isCancelled ? Colors.error : Colors.accent}
        strokeWidth={1.5}
      />
    </View>
  );
}
