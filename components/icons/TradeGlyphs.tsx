import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Drawn trades, for the categories nobody has rendered artwork for.
 *
 * The twenty-four painted icons are 3D renders: a bright green body, graphite
 * details, a chrome highlight. A thin outline glyph next to one of those does
 * not read as a different icon, it reads as a missing one - which is what the
 * first attempt at this looked like, and why it was rejected.
 *
 * So these are built from the same three materials, flat but filled: green for
 * the object, graphite for the working parts, chrome for anything metal. Solid
 * shapes rather than strokes, because weight is what the renders have and
 * outlines do not, and weight is most of what makes the two sit together.
 *
 * They sit on nothing - no tile, no border, no tint - exactly as the painted
 * ones do. The green box the fallback used to draw around itself was the other
 * half of why it stood out.
 */

const GREEN = '#78C043';
const GREEN_DEEP = '#559330';
const GRAPHITE = '#2E2E2E';
const CHROME = '#C6CBD1';

const SIZE = 40;

export type TradeGlyph = (props: { size?: number }) => React.ReactElement;

/** Every glyph draws in the same 40 unit box, so weights stay comparable. */
function Canvas({ size = SIZE, children }: { size?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {children}
    </Svg>
  );
}

/**
 * Air conditioning.
 *
 * A wall unit and the air coming out of it: the rectangle reads as the box on
 * the wall, and the two curves under it are what it does. A snowflake was the
 * first attempt and it was wrong - a snowflake is cold, which is a property of
 * the air, where the thing being booked is the unit.
 */
export const AirConditioning: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={3} y={7} width={34} height={15} rx={3.5} fill={GREEN} />
    {/* The lower half sits in its own shade, which is what gives a flat box a front. */}
    <Path d="M3 16 h34 v2.5 a3.5 3.5 0 0 1 -3.5 3.5 h-27 a3.5 3.5 0 0 1 -3.5 -3.5 Z" fill={GREEN_DEEP} />
    <Rect x={7} y={17.5} width={26} height={2.4} rx={1.2} fill={GRAPHITE} />
    <Circle cx={32} cy={11.5} r={1.6} fill={CHROME} />
    {/* The breeze. Two, not three: a third crowds the space under a 15 unit box. */}
    <Path
      d="M9 28 q4.5 -4 9 0 t9 0"
      stroke={GRAPHITE}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M12 34 q4 -3.5 8 0 t8 0"
      stroke={GREEN_DEEP}
      strokeWidth={2.4}
      strokeLinecap="round"
      fill="none"
    />
  </Canvas>
);

/** Generator: a body, a carry handle, an exhaust and a bolt for what it makes. */
export const Generator: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={11} y={7} width={16} height={3.4} rx={1.7} fill={GRAPHITE} />
    <Rect x={17} y={9} width={4} height={4} fill={GRAPHITE} />
    <Rect x={4} y={12} width={32} height={20} rx={4} fill={GREEN} />
    <Path d="M4 24 h32 v4 a4 4 0 0 1 -4 4 h-24 a4 4 0 0 1 -4 -4 Z" fill={GREEN_DEEP} />
    <Path d="M21 15 L15 23 h4 l-2 6 8 -9 h-4 Z" fill={GRAPHITE} />
    <Circle cx={31} cy={28} r={2} fill={CHROME} />
  </Canvas>
);

/** Waterproofing: a drop, and the roof keeping it out. */
export const Waterproofing: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M20 4 L35 13 v3 H5 v-3 Z" fill={GRAPHITE} />
    <Path
      d="M20 19 C15 26 12 29 12 32 a8 8 0 0 0 16 0 c0 -3 -3 -6 -8 -13 Z"
      fill={GREEN}
    />
    <Path d="M20 27 c-3 4 -4 5 -4 6.4 a4 4 0 0 0 8 0 c0 -1.4 -1 -2.4 -4 -6.4 Z" fill={GREEN_DEEP} />
  </Canvas>
);

/** Glass work: a pane, its bars, and the highlight that says it is glass. */
export const GlassWork: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={5} y={5} width={30} height={30} rx={3} fill={GREEN} />
    <Rect x={9} y={9} width={22} height={22} rx={1.5} fill="#FFFFFF" fillOpacity={0.92} />
    <Rect x={19} y={9} width={2} height={22} fill={GRAPHITE} />
    <Rect x={9} y={19} width={22} height={2} fill={GRAPHITE} />
    <Path d="M11 29 L20 11 h3 L14 29 Z" fill={CHROME} fillOpacity={0.75} />
  </Canvas>
);

/** Welding: a torch and its flame. */
export const Welding: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M6 32 L18 20 l4 4 L10 36 Z" fill={GRAPHITE} />
    <Path d="M17 19 l6 6 4 -4 -6 -6 Z" fill={CHROME} />
    <Path d="M30 6 c-5 5 -7 7 -7 10 a7 7 0 0 0 14 0 c0 -3 -2 -5 -7 -10 Z" fill={GREEN} />
    <Path d="M30 14 c-2.4 2.6 -3 3.4 -3 4.6 a3 3 0 0 0 6 0 c0 -1.2 -0.6 -2 -3 -4.6 Z" fill={GREEN_DEEP} />
  </Canvas>
);

/** Tailoring and laundry: a shirt. */
export const Tailoring: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M15 6 L8 10 L4 16 l6 4 2 -3 v16 h16 V17 l2 3 6 -4 -4 -6 -7 -4 Z" fill={GREEN} />
    <Path d="M12 26 h16 v7 H12 Z" fill={GREEN_DEEP} />
    <Path d="M15 6 l5 6 5 -6 -2.5 -1.5 L20 8 l-2.5 -3.5 Z" fill={GRAPHITE} />
    <Circle cx={20} cy={22} r={1.4} fill={CHROME} />
  </Canvas>
);

/** Satellite and cable: a dish on its arm. */
export const Satellite: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Ellipse cx={19} cy={17} rx={14} ry={11} fill={GREEN} transform="rotate(-18 19 17)" />
    <Ellipse cx={19} cy={17} rx={9} ry={6.5} fill={GREEN_DEEP} transform="rotate(-18 19 17)" />
    <Circle cx={19} cy={17} r={2.6} fill={CHROME} />
    <Path d="M24 24 L28 34" stroke={GRAPHITE} strokeWidth={3} strokeLinecap="round" />
    <Rect x={22} y={33} width={13} height={3.4} rx={1.7} fill={GRAPHITE} />
  </Canvas>
);

/** Internet: a router and the signal off it. */
export const Internet: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M12 16 q8 -8 16 0" stroke={GREEN_DEEP} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <Path d="M6 11 q14 -13 28 0" stroke={GRAPHITE} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    <Rect x={5} y={22} width={30} height={12} rx={3.5} fill={GREEN} />
    <Path d="M5 29 h30 v1.5 a3.5 3.5 0 0 1 -3.5 3.5 h-23 a3.5 3.5 0 0 1 -3.5 -3.5 Z" fill={GREEN_DEEP} />
    <Circle cx={11} cy={26} r={1.6} fill={GRAPHITE} />
    <Circle cx={17} cy={26} r={1.6} fill={CHROME} />
  </Canvas>
);

/** Locksmith: a padlock. */
export const Locksmith: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path
      d="M12 18 v-4 a8 8 0 0 1 16 0 v4"
      stroke={CHROME}
      strokeWidth={4}
      fill="none"
      strokeLinecap="round"
    />
    <Rect x={7} y={17} width={26} height={19} rx={4} fill={GREEN} />
    <Path d="M7 28 h26 v4 a4 4 0 0 1 -4 4 h-18 a4 4 0 0 1 -4 -4 Z" fill={GREEN_DEEP} />
    <Circle cx={20} cy={25} r={3} fill={GRAPHITE} />
    <Rect x={18.7} y={25} width={2.6} height={6} rx={1.3} fill={GRAPHITE} />
  </Canvas>
);

/** Moving: a truck. */
export const Moving: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={2} y={12} width={21} height={16} rx={2.5} fill={GREEN} />
    <Path d="M23 17 h7 l6 6 v5 h-13 Z" fill={GREEN_DEEP} />
    <Rect x={25} y={19} width={6} height={4} rx={1} fill={CHROME} />
    <Circle cx={11} cy={30} r={4} fill={GRAPHITE} />
    <Circle cx={29} cy={30} r={4} fill={GRAPHITE} />
    <Circle cx={11} cy={30} r={1.6} fill={CHROME} />
    <Circle cx={29} cy={30} r={1.6} fill={CHROME} />
  </Canvas>
);

/** Landscaping: a leaf on its stem. */
export const Landscaping: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M20 36 V18" stroke={GRAPHITE} strokeWidth={2.6} strokeLinecap="round" />
    <Path d="M20 22 C10 22 6 16 7 7 c10 -1 15 5 13 15 Z" fill={GREEN} />
    <Path d="M20 20 C24 11 29 7 34 7 c1 9 -5 15 -14 15 Z" fill={GREEN_DEEP} />
  </Canvas>
);

/** Photography: a camera. */
export const Photography: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M14 8 h12 l2 4 h4 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 H8 a4 4 0 0 1 -4 -4 V16 a4 4 0 0 1 4 -4 h4 Z" fill={GREEN} />
    <Circle cx={20} cy={23} r={8} fill={GRAPHITE} />
    <Circle cx={20} cy={23} r={4.5} fill={CHROME} />
    <Circle cx={31} cy={17} r={1.8} fill={GREEN_DEEP} />
  </Canvas>
);

/** Salon: scissors. */
export const Salon: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M12 5 L27 27" stroke={CHROME} strokeWidth={3.4} strokeLinecap="round" />
    <Path d="M28 5 L13 27" stroke={GRAPHITE} strokeWidth={3.4} strokeLinecap="round" />
    <Circle cx={11} cy={31} r={5} fill="none" stroke={GREEN} strokeWidth={3.4} />
    <Circle cx={29} cy={31} r={5} fill="none" stroke={GREEN_DEEP} strokeWidth={3.4} />
  </Canvas>
);

/** Catering: a pot on the heat. */
export const Catering: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={6} y={15} width={28} height={16} rx={3.5} fill={GREEN} />
    <Path d="M6 24 h28 v3.5 a3.5 3.5 0 0 1 -3.5 3.5 h-21 a3.5 3.5 0 0 1 -3.5 -3.5 Z" fill={GREEN_DEEP} />
    <Rect x={4} y={12} width={32} height={3.4} rx={1.7} fill={GRAPHITE} />
    <Rect x={18.6} y={7} width={2.8} height={5} rx={1.4} fill={GRAPHITE} />
    <Path d="M11 36 h18" stroke={CHROME} strokeWidth={2.4} strokeLinecap="round" />
  </Canvas>
);

/** Tutoring: a graduate's cap. */
export const Tutoring: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M20 8 L38 16 L20 24 L2 16 Z" fill={GREEN} />
    <Path d="M10 20 v7 c0 3 5 5 10 5 s10 -2 10 -5 v-7 l-10 4.5 Z" fill={GREEN_DEEP} />
    <Path d="M36 17 v8" stroke={GRAPHITE} strokeWidth={2.2} strokeLinecap="round" />
    <Circle cx={36} cy={27} r={2.4} fill={GRAPHITE} />
  </Canvas>
);

/** Furniture and interiors: a sofa. */
export const Furniture: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={6} y={11} width={28} height={12} rx={4} fill={GREEN_DEEP} />
    <Rect x={2} y={18} width={36} height={12} rx={4} fill={GREEN} />
    <Rect x={2} y={16} width={6} height={12} rx={3} fill={GRAPHITE} />
    <Rect x={32} y={16} width={6} height={12} rx={3} fill={GRAPHITE} />
    <Rect x={6} y={30} width={3} height={4} rx={1.5} fill={GRAPHITE} />
    <Rect x={31} y={30} width={3} height={4} rx={1.5} fill={GRAPHITE} />
  </Canvas>
);

/** Fumigation: a spray can, and what it sprays. */
export const Fumigation: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={11} y={13} width={16} height={23} rx={3.5} fill={GREEN} />
    <Path d="M11 28 h16 v4.5 a3.5 3.5 0 0 1 -3.5 3.5 h-9 a3.5 3.5 0 0 1 -3.5 -3.5 Z" fill={GREEN_DEEP} />
    <Rect x={15} y={8} width={8} height={5} rx={1.5} fill={GRAPHITE} />
    <Rect x={13} y={19} width={12} height={5} rx={1} fill="#FFFFFF" fillOpacity={0.85} />
    <Circle cx={31} cy={9} r={1.7} fill={GRAPHITE} />
    <Circle cx={35} cy={13} r={1.3} fill={GRAPHITE} />
    <Circle cx={31} cy={16} r={1} fill={GRAPHITE} />
  </Canvas>
);

/** Ceilings and screeding: layers. */
export const Ceilings: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M20 5 L37 13 L20 21 L3 13 Z" fill={GREEN} />
    <Path d="M20 16 L34 22 L20 28 L6 22 Z" fill={GREEN_DEEP} />
    <Path d="M20 24 L31 29 L20 34 L9 29 Z" fill={GRAPHITE} />
  </Canvas>
);

/** Bathroom fitting: a tub and its tap. */
export const Bathroom: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M10 6 v10" stroke={CHROME} strokeWidth={3} strokeLinecap="round" />
    <Path d="M10 8 h7 a3 3 0 0 1 3 3 v3" stroke={GRAPHITE} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Rect x={3} y={18} width={34} height={5} rx={2.5} fill={GRAPHITE} />
    <Path d="M6 23 h28 v5 a7 7 0 0 1 -7 7 H13 a7 7 0 0 1 -7 -7 Z" fill={GREEN} />
    <Path d="M6 29 h28 a7 7 0 0 1 -7 6 H13 a7 7 0 0 1 -7 -6 Z" fill={GREEN_DEEP} />
  </Canvas>
);

/** Construction: a hard hat. */
export const Construction: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Path d="M9 25 v-4 a11 11 0 0 1 22 0 v4 Z" fill={GREEN} />
    <Rect x={17} y={11} width={6} height={11} fill={GREEN_DEEP} />
    <Rect x={3} y={25} width={34} height={5} rx={2.5} fill={GRAPHITE} />
    <Rect x={16} y={7} width={8} height={4} rx={2} fill={CHROME} />
  </Canvas>
);

/**
 * The last resort, and a deliberate echo of the plumbing render: a green pipe
 * with a graphite wrench across it. A category this reaches is one nobody has
 * a word for yet, and a tool is the truest thing to show for it.
 */
export const GeneralRepair: TradeGlyph = ({ size }) => (
  <Canvas size={size}>
    <Rect x={3} y={16} width={34} height={11} rx={3} fill={GREEN} />
    <Rect x={3} y={21.5} width={34} height={5.5} fill={GREEN_DEEP} />
    <Rect x={30} y={14} width={6} height={15} rx={2} fill={GREEN} />
    <G transform="rotate(-32 20 21)">
      <Rect x={17} y={6} width={6} height={20} rx={3} fill={GRAPHITE} />
      <Path d="M20 3 a5 5 0 1 1 -0.1 0 Z M17.4 3.6 v4.4 h5.2 V3.6 Z" fill={CHROME} />
      <Circle cx={20} cy={29} r={3.4} fill={CHROME} />
      <Circle cx={20} cy={29} r={1.6} fill={GRAPHITE} />
    </G>
  </Canvas>
);
