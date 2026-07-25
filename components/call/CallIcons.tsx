import React from 'react';
import Svg, { G, Line, Path } from 'react-native-svg';

export type CallIconProps = {
  size?: number;
  color?: string;
  /** Override stroke width (defaults scale with size). */
  strokeWidth?: number;
};

function strokeForSize(size: number, fine = false): number {
  const ratio = fine ? 1.58 : 1.72;
  return Math.max(1.35, Math.round((size / 24) * ratio * 100) / 100);
}

/** Classic handset — answer / call / callback. */
const HANDSET_PATH =
  'M7.42 11.08c1.49 2.98 3.94 5.43 6.92 6.92l1.08-1.08a1.65 1.65 0 0 1 1.74-.44c.92.24 1.88.4 2.86.46a1.65 1.65 0 0 1 1.42 1.68v1.41a1.65 1.65 0 0 1-1.8 1.65 15.2 15.2 0 0 1-6.54-2.35A15.05 15.05 0 0 1 3.8 5.36 1.65 1.65 0 0 1 5.45 3.8h1.41a1.65 1.65 0 0 1 1.68 1.42c.06.98.22 1.94.46 2.86a1.65 1.65 0 0 1-.44 1.74L7.42 11.08z';

export function CallIconAnswer({ size = 24, color = '#FFFFFF', strokeWidth }: CallIconProps) {
  const sw = strokeWidth ?? strokeForSize(size);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={HANDSET_PATH}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** End / decline — handset oriented down (iOS-style). */
export function CallIconEnd({ size = 24, color = '#FFFFFF', strokeWidth }: CallIconProps) {
  const sw = strokeWidth ?? strokeForSize(size);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G rotation={135} origin="12, 12">
        <Path
          d={HANDSET_PATH}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

/** Toolbar / chat header — handset with subtle signal arcs. */
export function CallIconOutline({ size = 20, color = '#4F6739', strokeWidth }: CallIconProps) {
  const sw = strokeWidth ?? strokeForSize(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={HANDSET_PATH}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.2 3.8c2.2 1.65 3.6 4.22 3.6 7.1"
        stroke={color}
        strokeWidth={sw * 0.85}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Path
        d="M19.4 2c3.05 2.3 5 5.85 5 9.85"
        stroke={color}
        strokeWidth={sw * 0.75}
        strokeLinecap="round"
        opacity={0.35}
      />
    </Svg>
  );
}

export function CallIconMic({ size = 22, color = '#111827', strokeWidth }: CallIconProps) {
  const sw = strokeWidth ?? strokeForSize(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 14.5a3 3 0 0 0 3-3V6.5a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 11.5a5.5 5.5 0 0 0 11 0"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Line x1={12} y1={17} x2={12} y2={20.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={9.25} y1={20.5} x2={14.75} y2={20.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

export function CallIconMicOff({ size = 22, color = '#111827', strokeWidth }: CallIconProps) {
  const sw = strokeWidth ?? strokeForSize(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 14.5a3 3 0 0 0 3-3V6.5a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 11.5a5.5 5.5 0 0 0 11 0"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Line x1={12} y1={17} x2={12} y2={20.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={9.25} y1={20.5} x2={14.75} y2={20.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={4.5} y1={4.5} x2={19.5} y2={19.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

export function CallIconSpeaker({
  size = 22,
  color = '#111827',
  active = false,
  strokeWidth,
}: CallIconProps & { active?: boolean }) {
  const sw = strokeWidth ?? strokeForSize(size, true);
  const wave = active ? color : color;
  const waveOpacity = active ? 0.95 : 0.45;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 9.5h3l3.75-2.65V17.15L8.5 14.5h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.75 9.25a4.25 4.25 0 0 1 0 5.5"
        stroke={wave}
        strokeWidth={sw * 0.92}
        strokeLinecap="round"
        opacity={waveOpacity}
      />
      <Path
        d="M16.85 7.15a7 7 0 0 1 0 9.7"
        stroke={wave}
        strokeWidth={sw * 0.82}
        strokeLinecap="round"
        opacity={active ? 0.75 : 0.28}
      />
    </Svg>
  );
}

export function CallIconMessage({ size = 22, color = '#4F6739', strokeWidth }: CallIconProps) {
  const sw = strokeWidth ?? strokeForSize(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 5.75h13a1.75 1.75 0 0 1 1.75 1.75v7a1.75 1.75 0 0 1-1.75 1.75H10l-3.25 2.6V7.5a1.75 1.75 0 0 1 1.75-1.75z"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={8.25} y1={10} x2={15.75} y2={10} stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" />
      <Line x1={8.25} y1={13.25} x2={13.5} y2={13.25} stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" />
    </Svg>
  );
}
