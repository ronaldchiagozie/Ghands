import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

/**
 * The trades, drawn small and scattered.
 *
 * A receipt is the one screen that leaves the app. Somebody sends it to a
 * landlord, an employer, a family member paying for the work - and a bare
 * white card with numbers on it says nothing about who produced it. This is
 * what a messaging app puts behind a conversation, for the same reason: it
 * costs the reader nothing and makes the surface belong to somebody.
 *
 * Themed rather than decorative. The glyphs are the trades this app books -
 * a wrench, a drop of water, a bulb, a roller - so the pattern is about the
 * work rather than being wallpaper that could sit behind anything.
 *
 * Drawn as strokes, not fills. Line art stays legible at three percent, where
 * filled shapes turn to grey mush; and it is the one weight that survives
 * being screenshotted, resized and forwarded, which is what happens to every
 * receipt somebody actually shares.
 */

type ToolPatternProps = {
  /** Ink for the line work. */
  color?: string;
  /**
   * Very low by default. This sits behind money: anything strong enough to be
   * read as a picture is strong enough to interfere with a figure somebody is
   * checking.
   */
  opacity?: number;
  /** Tile edge. Larger tiles read as scattered; smaller ones as a repeat. */
  tile?: number;
  strokeWidth?: number;
};

/**
 * One glyph, placed and turned.
 *
 * The rotations are deliberately uneven and none of them is a right angle -
 * that is what stops twelve drawings on a grid from reading as a grid.
 */
function Glyph({
  x,
  y,
  rotate,
  scale = 1,
  children,
}: {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
  children: React.ReactNode;
}) {
  return <G transform={`translate(${x}, ${y}) rotate(${rotate}) scale(${scale})`}>{children}</G>;
}

export default function ToolPattern({
  color = '#111827',
  opacity = 0.05,
  tile = 190,
  strokeWidth = 1.6,
}: ToolPatternProps) {
  /** Shared by every path, so the whole set reads as one hand. */
  const line = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    /**
     * Behind everything and deaf to touch. Without `pointerEvents="none"` this
     * fills its parent and swallows every tap meant for what it sits behind.
     */
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" opacity={opacity}>
        <Defs>
          <Pattern id="ghandsTools" x="0" y="0" width={tile} height={tile} patternUnits="userSpaceOnUse">
            {/* Wrench */}
            <Glyph x={14} y={18} rotate={-24}>
              <Path d="M14 1 a6 6 0 1 0 -4.6 10.2 L1 19.6" {...line} />
              <Path d="M14 1 L9.6 5.4 L11.6 9 L15.6 8.4 Z" {...line} />
            </Glyph>

            {/* Drop of water */}
            <Glyph x={78} y={10} rotate={12}>
              <Path d="M8 0 C3 6 0 9 0 12 a8 8 0 0 0 16 0 c0 -3 -3 -6 -8 -12 Z" {...line} />
            </Glyph>

            {/* Bulb */}
            <Glyph x={128} y={26} rotate={-8}>
              <Path d="M7 14 a7 7 0 1 1 4 0" {...line} />
              <Path d="M6.5 15.5 h5 M7.5 18.5 h3" {...line} />
            </Glyph>

            {/* Hex nut */}
            <Glyph x={40} y={58} rotate={16}>
              <Path d="M8 0 L15 4 L15 12 L8 16 L1 12 L1 4 Z" {...line} />
              <Circle cx={8} cy={8} r={3.2} {...line} />
            </Glyph>

            {/* Paint roller */}
            <Glyph x={100} y={62} rotate={28}>
              <Rect x={0} y={0} width={16} height={7} rx={2} {...line} />
              <Path d="M8 7 v4 h-4 v8" {...line} />
            </Glyph>

            {/* Screwdriver */}
            <Glyph x={152} y={72} rotate={-40}>
              <Path d="M2 0 h5 v7 h-5 Z" {...line} />
              <Path d="M4.5 7 v11" {...line} />
            </Glyph>

            {/* Bolt of electricity */}
            <Glyph x={16} y={102} rotate={6}>
              <Path d="M7 0 L1 9 L5.5 9 L3 18 L11 7 L6.5 7 Z" {...line} />
            </Glyph>

            {/* Gear */}
            <Glyph x={62} y={110} rotate={-14}>
              <Circle cx={9} cy={9} r={6} {...line} />
              <Circle cx={9} cy={9} r={2.2} {...line} />
              <Path d="M9 0 v3 M9 15 v3 M0 9 h3 M15 9 h3" {...line} />
            </Glyph>

            {/* Hammer */}
            <Glyph x={124} y={116} rotate={34}>
              <Path d="M0 3 h11 v6 h-11 a3 3 0 0 1 0 -6 Z" {...line} />
              <Path d="M11 6 h7" {...line} />
            </Glyph>

            {/* Ruler */}
            <Glyph x={22} y={148} rotate={-30}>
              <Rect x={0} y={0} width={20} height={7} rx={1.5} {...line} />
              <Path d="M5 0 v3 M10 0 v4 M15 0 v3" {...line} />
            </Glyph>

            {/* Plug */}
            <Glyph x={82} y={152} rotate={18}>
              <Path d="M2 6 h10 v4 a5 5 0 0 1 -10 0 Z" {...line} />
              <Path d="M4.5 6 v-5 M9.5 6 v-5 M7 14 v4" {...line} />
            </Glyph>

            {/* Pipe elbow */}
            <Glyph x={146} y={146} rotate={-6}>
              <Path d="M0 14 v-6 a8 8 0 0 1 8 -8 h6" {...line} />
              <Path d="M-2.5 14 h5 M14 -2.5 v5" {...line} />
            </Glyph>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ghandsTools)" />
      </Svg>
    </View>
  );
}
