import { HandHelping } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

/**
 * Handy's mark.
 *
 * It was three four-point stars, which is the house style of every AI feature
 * shipped in the last two years and says nothing about this one. The assistant
 * is called Handy, the product is GHands, and the job is somebody turning up to
 * fix your sink. A helping hand is the thing it actually means, and it belongs
 * to this app rather than to the category.
 *
 * The file name and the exported names are unchanged on purpose: they are
 * referenced from the home FAB, the draft chip and the provider app, and a
 * rename would be churn across three call sites for no gain. The variants keep
 * their meanings so nothing above has to know the drawing changed.
 */

const HANDY_LIME = '#E4FF5C';
const HANDY_TEAL = '#003D4D';

type AiHandyIconProps = {
  variant?: 'default' | 'fab' | 'fab-shoulder' | 'lg' | 'chip';
  /** `chip` only - rendered edge length. */
  size?: number;
  /** `chip` only - overrides the teal stroke. */
  tint?: string;
};

/**
 * Kept as a named export because the shoulder layout imports it directly.
 * There is nothing to place beside the mark now that it is a single glyph, so
 * it renders the mark itself rather than an empty decoration.
 */
export function AiFabShoulderSparkles() {
  return (
    <View pointerEvents="none">
      <HandHelping size={22} color={HANDY_LIME} strokeWidth={2} />
    </View>
  );
}

export default function AiSparkleIcon({ variant = 'default', size, tint }: AiHandyIconProps) {
  if (variant === 'fab' || variant === 'lg') {
    return <HandHelping size={28} color={HANDY_LIME} strokeWidth={2} />;
  }

  if (variant === 'chip') {
    return <HandHelping size={size ?? 15} color={tint ?? HANDY_TEAL} strokeWidth={2.2} />;
  }

  if (variant === 'fab-shoulder') {
    return <AiFabShoulderSparkles />;
  }

  return <HandHelping size={24} color={HANDY_LIME} strokeWidth={2} />;
}
