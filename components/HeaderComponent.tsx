import React from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';

/** @deprecated Use ScreenHeader directly — kept for existing imports. */
export default function HeaderComponent({
  name,
  onPress,
}: {
  name: string;
  onPress: () => void;
}) {
  return <ScreenHeader title={name} onBack={onPress} />;
}
