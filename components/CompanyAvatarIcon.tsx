import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Three people, one in front: what a company shows in place of a photo.
 *
 * The icon set has a two-person "users" mark and nothing for a group, and two
 * people reads as a couple rather than an organisation. Drawn on the same
 * 24-unit grid and stroke as the rest of the icons so it sits with them.
 * Identical in both apps.
 */
export function CompanyAvatarIcon({
  size = 24,
  color = '#6B7280',
  strokeWidth = 1.75,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={5.5} cy={9.5} r={2.2} />
      <Path d="M1.5 18.5v-.8a4 4 0 0 1 5.6-3.7" />
      <Circle cx={18.5} cy={9.5} r={2.2} />
      <Path d="M22.5 18.5v-.8a4 4 0 0 0-5.6-3.7" />
      <Circle cx={12} cy={8} r={3} />
      <Path d="M6.5 19.5v-1a5.5 5.5 0 0 1 11 0v1" />
    </Svg>
  );
}
