import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type JobTabKind = 'Pending' | 'Ongoing' | 'Completed';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function sw(size: number, fine = false): number {
  const ratio = fine ? 1.55 : 1.68;
  return Math.max(1.25, Math.round((size / 24) * ratio * 100) / 100);
}

/** Jobs tab — waiting for providers / action. */
export function JobTabIconPending({ size = 20, color = '#4F6739', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.25} stroke={color} strokeWidth={s} opacity={0.35} />
      <Circle cx={12} cy={12} r={5.5} stroke={color} strokeWidth={s} />
      <Line x1={12} y1={12} x2={12} y2={8.75} stroke={color} strokeWidth={s} strokeLinecap="round" />
      <Line x1={12} y1={12} x2={14.75} y2={13.5} stroke={color} strokeWidth={s * 0.92} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={1.1} fill={color} />
    </Svg>
  );
}

/** Jobs tab — active work in progress. */
export function JobTabIconOngoing({ size = 20, color = '#4F6739', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 9.5h13a1.75 1.75 0 0 1 1.75 1.75v6.5A1.75 1.75 0 0 1 18.5 19.5h-13A1.75 1.75 0 0 1 3.75 17.75v-6.5A1.75 1.75 0 0 1 5.5 9.5z"
        stroke={color}
        strokeWidth={s}
        strokeLinejoin="round"
      />
      <Path
        d="M9 9.5V8a3 3 0 0 1 6 0v1.5"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
      />
      <Path
        d="M8.25 14h2.1M13.65 14h2.1"
        stroke={color}
        strokeWidth={s * 0.88}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M17.5 6.5c1.65.85 2.75 2.55 2.75 4.5"
        stroke={color}
        strokeWidth={s * 0.85}
        strokeLinecap="round"
        opacity={0.45}
      />
    </Svg>
  );
}

/** Jobs tab — finished jobs. */
export function JobTabIconCompleted({ size = 20, color = '#4F6739', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.25} stroke={color} strokeWidth={s} />
      <Path
        d="M8.25 12.1l2.35 2.35L15.9 9.15"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function JobTabIcon({ tab, size = 20, color = '#4F6739' }: IconProps & { tab: JobTabKind }) {
  switch (tab) {
    case 'Pending':
      return <JobTabIconPending size={size} color={color} />;
    case 'Completed':
      return <JobTabIconCompleted size={size} color={color} />;
    case 'Ongoing':
    default:
      return <JobTabIconOngoing size={size} color={color} />;
  }
}

/** Small meta row icons on job cards (optional). */
export function JobMetaIconQuotes({ size = 16, color = '#6B7280', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 5.5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H8"
        stroke={color}
        strokeWidth={s}
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 8.5H5a1.5 1.5 0 0 0-1.5 1.5V18a1.5 1.5 0 0 0 1.5 1.5h.5"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
      />
      <Line x1={9.5} y1={10} x2={16.5} y2={10} stroke={color} strokeWidth={s * 0.9} strokeLinecap="round" />
      <Line x1={9.5} y1={13.5} x2={14.5} y2={13.5} stroke={color} strokeWidth={s * 0.9} strokeLinecap="round" />
    </Svg>
  );
}

export function JobMetaIconPerson({ size = 16, color = '#6B7280', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.25} r={3.25} stroke={color} strokeWidth={s} />
      <Path
        d="M5.75 18.25c.85-2.65 3.05-4.25 6.25-4.25s5.4 1.6 6.25 4.25"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function JobMetaIconCalendar({ size = 16, color = '#6B7280', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={6.5} width={15} height={13} rx={2} stroke={color} strokeWidth={s} />
      <Line x1={4.5} y1={10.5} x2={19.5} y2={10.5} stroke={color} strokeWidth={s} />
      <Line x1={8.5} y1={4.75} x2={8.5} y2={8} stroke={color} strokeWidth={s} strokeLinecap="round" />
      <Line x1={15.5} y1={4.75} x2={15.5} y2={8} stroke={color} strokeWidth={s} strokeLinecap="round" />
    </Svg>
  );
}

export function JobMetaIconLocation({ size = 16, color = '#6B7280', strokeWidth }: IconProps) {
  const s = strokeWidth ?? sw(size, true);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s6.5-4.65 6.5-10a6.5 6.5 0 1 0-13 0c0 5.35 6.5 10 6.5 10z"
        stroke={color}
        strokeWidth={s}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={11} r={2.1} stroke={color} strokeWidth={s * 0.92} />
    </Svg>
  );
}
