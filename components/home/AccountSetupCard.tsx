import { Bell, CreditCard, MapPin, RectangleEllipsis, User } from 'lucide-react-native';
import React from 'react';

import { SetupStepsCarousel, type SetupStep, type SetupStepIcon } from '@/components/SetupStepsCarousel';
import type { SetupTask, SetupTaskId } from '@/hooks/useAccountSetup';

const TASK_ICON: Record<SetupTaskId, SetupStepIcon> = {
  profile: User,
  location: MapPin,
  /** A PIN field with its dots: what the step asks for, not a generic badge. */
  pin: RectangleEllipsis,
  bank: CreditCard,
  notifications: Bell,
};

/** One line each; the task's own detail wraps to two, which made the cards tall. */
const SHORT_DETAIL: Record<SetupTaskId, string> = {
  profile: 'So providers can reach you.',
  location: 'Where providers come to you.',
  pin: 'Protects your wallet payments.',
  bank: 'For refunds and withdrawals.',
  notifications: 'Hear when a provider replies.',
};

const ACTION_LABEL: Record<SetupTaskId, string> = {
  profile: 'Add details',
  location: 'Set location',
  pin: 'Create PIN',
  bank: 'Add bank account',
  notifications: 'Turn on',
};

type AccountSetupCardProps = {
  outstanding: SetupTask[];
  completedCount: number;
  totalCount: number;
  onTaskPress: (id: SetupTaskId) => void;
  /** The page's side margin, so the cards can run to the screen edge. */
  bleed?: number;
};

/**
 * Shows only what is actually left to do, one card per task, and disappears
 * when nothing is. A checklist that never changes stops being read.
 */
export default function AccountSetupCard({
  outstanding,
  completedCount,
  totalCount,
  onTaskPress,
  bleed,
}: AccountSetupCardProps) {
  if (outstanding.length === 0) return null;

  const required = outstanding.filter((t) => t.required).length;
  const steps: SetupStep[] = outstanding.map((task) => ({
    key: task.id,
    title: task.title,
    description: SHORT_DETAIL[task.id],
    icon: TASK_ICON[task.id],
    actionLabel: ACTION_LABEL[task.id],
    status: 'todo',
    onPress: () => onTaskPress(task.id),
  }));

  return (
    <SetupStepsCarousel
      title="Finish setting up"
      subtitle={
        required > 0
          ? 'A couple of things are needed before you can book.'
          : 'Optional, but they make everything smoother.'
      }
      done={completedCount}
      total={totalCount}
      steps={steps}
      bleed={bleed}
    />
  );
}
