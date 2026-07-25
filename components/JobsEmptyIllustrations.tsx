import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

type IllustrationProps = {
  size?: number;
};

const SAGE = '#4F6739';
const SAGE_LIGHT = '#E8F0E0';
const SAGE_HALO = '#F2F8EA';
const AMBER_HALO = '#FFFBEB';
const AMBER_STROKE = '#F59E0B';
const GREEN = '#16A34A';
const RED = '#DC2626';

function Halo({ cx = 80, cy = 82 }: { cx?: number; cy?: number }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={58} fill={SAGE_HALO} />
      <Circle cx={cx} cy={cy} r={50} stroke="#D8E6C8" strokeWidth={1.25} opacity={0.65} />
    </>
  );
}

/** Active / ongoing — briefcase with refined progress arc. */
export function OngoingJobsIllustration({ size = 148 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Halo />
      <Circle
        cx={80}
        cy={82}
        r={42}
        stroke={SAGE}
        strokeWidth={1.75}
        strokeDasharray="5 7"
        opacity={0.35}
      />
      <Path
        d="M52 78.5h56a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H52a3 3 0 0 1-3-3v-22a3 3 0 0 1 3-3z"
        stroke={SAGE}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="#FFFFFF"
      />
      <Path
        d="M66 78.5V73a14 14 0 0 1 28 0v5.5"
        stroke={SAGE}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line x1={62} y1={92} x2={98} y2={92} stroke={SAGE} strokeWidth={1.75} strokeLinecap="round" opacity={0.45} />
      <Line x1={62} y1={99} x2={88} y2={99} stroke={SAGE} strokeWidth={1.75} strokeLinecap="round" opacity={0.3} />
      <Path
        d="M108 96c4.5 1.2 8.2 4.2 10.5 8.2"
        stroke={GREEN}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M114 108l6 6 14-16"
        stroke={GREEN}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Pending — clipboard + fine clock badge. */
export function PendingJobsIllustration({ size = 148 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Circle cx={80} cy={82} r={58} fill={AMBER_HALO} />
      <Circle cx={80} cy={82} r={50} stroke="#FDE68A" strokeWidth={1.25} opacity={0.8} />
      <Rect x={50} y={46} width={60} height={78} rx={10} fill="#FFFFFF" stroke="#F5D98A" strokeWidth={1.75} />
      <Rect x={68} y={38} width={24} height={14} rx={5} fill={AMBER_STROKE} opacity={0.9} />
      <Line x1={60} y1={66} x2={100} y2={66} stroke="#FDE68A" strokeWidth={4} strokeLinecap="round" />
      <Line x1={60} y1={78} x2={92} y2={78} stroke="#FDE68A" strokeWidth={4} strokeLinecap="round" />
      <Line x1={60} y1={90} x2={96} y2={90} stroke="#FDE68A" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={112} cy={108} r={20} fill={AMBER_STROKE} />
      <Circle cx={112} cy={108} r={14.5} stroke="#FFFFFF" strokeWidth={1.75} />
      <Line x1={112} y1={108} x2={112} y2={101} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Line x1={112} y1={108} x2={117} y2={111} stroke="#FFFFFF" strokeWidth={1.75} strokeLinecap="round" />
    </Svg>
  );
}

/** Completed — checklist with seal check. */
export function CompletedJobsIllustration({ size = 148 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Halo />
      <Rect x={50} y={46} width={60} height={78} rx={10} fill="#FFFFFF" stroke="#C8D9B4" strokeWidth={1.75} />
      <Rect x={68} y={38} width={24} height={14} rx={5} fill={SAGE} />
      <Circle cx={62} cy={68} r={8} fill={GREEN} />
      <Path d="M58 68 L60.8 70.8 L66.5 65.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={76} y1={68} x2={104} y2={68} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={62} cy={88} r={8} fill={GREEN} />
      <Path d="M58 88 L60.8 90.8 L66.5 85.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={76} y1={88} x2={108} y2={88} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={62} cy={108} r={8} fill={GREEN} />
      <Path d="M58 108 L60.8 110.8 L66.5 105.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={76} y1={108} x2={100} y2={108} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={112} cy={108} r={20} fill={SAGE} />
      <Path d="M104 108l5.5 5.5L120 99" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Quotations empty — document + tag. */
export function QuotationsEmptyIllustration({ size = 148 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Halo />
      <G rotation={-5} origin="80, 82">
        <Rect x={48} y={50} width={64} height={84} rx={11} fill="#FFFFFF" stroke="#C8D9B4" strokeWidth={1.75} />
        <Line x1={60} y1={68} x2={100} y2={68} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
        <Line x1={60} y1={80} x2={92} y2={80} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
        <Line x1={60} y1={92} x2={96} y2={92} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
        <Line x1={60} y1={110} x2={84} y2={110} stroke={SAGE_LIGHT} strokeWidth={4} strokeLinecap="round" />
      </G>
      <Circle cx={110} cy={106} r={20} fill={SAGE} />
      <Line x1={102} y1={106} x2={118} y2={106} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" />
      <Line x1={110} y1={98} x2={110} y2={114} stroke="#FFFFFF" strokeWidth={2.25} strokeLinecap="round" />
    </Svg>
  );
}

/** Cancelled — soft document + X seal. */
export function CancelledJobsIllustration({ size = 148 }: IllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <Circle cx={80} cy={82} r={58} fill="#FEF2F2" />
      <Circle cx={80} cy={82} r={50} stroke="#FECACA" strokeWidth={1.25} opacity={0.85} />
      <G rotation={-6} origin="80, 82">
        <Rect x={48} y={50} width={64} height={84} rx={11} fill="#FFFFFF" stroke="#FECACA" strokeWidth={1.75} />
        <Line x1={60} y1={68} x2={100} y2={68} stroke="#FEE2E2" strokeWidth={4} strokeLinecap="round" />
        <Line x1={60} y1={80} x2={92} y2={80} stroke="#FEE2E2" strokeWidth={4} strokeLinecap="round" />
        <Line x1={60} y1={92} x2={96} y2={92} stroke="#FEE2E2" strokeWidth={4} strokeLinecap="round" />
      </G>
      <Circle cx={108} cy={108} r={20} fill={RED} />
      <Line x1={100} y1={100} x2={116} y2={116} stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={116} y1={100} x2={100} y2={116} stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export type JobsEmptyVariant = 'ongoing' | 'pending' | 'completed' | 'cancelled';

export function JobsEmptyIllustration({
  variant,
  size = 148,
}: {
  variant: JobsEmptyVariant;
  size?: number;
}) {
  switch (variant) {
    case 'pending':
      return <PendingJobsIllustration size={size} />;
    case 'completed':
      return <CompletedJobsIllustration size={size} />;
    case 'cancelled':
      return <CancelledJobsIllustration size={size} />;
    case 'ongoing':
    default:
      return <OngoingJobsIllustration size={size} />;
  }
}
