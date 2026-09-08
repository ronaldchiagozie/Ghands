import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

/**
 * The chevron lattice, tone on tone.
 *
 * A brand surface with nothing on it is a rectangle of paint. This is what
 * separates a coloured block from something somebody designed: texture you
 * notice only if you look for it, made of the brand's own geometry rather than
 * a stock texture.
 *
 * Two chevrons per tile at two strengths, which is where the reference gets
 * its depth - the original does it with a light green and a dark green, and
 * the same reading comes from one colour at two opacities without adding a
 * third hue to a palette that does not need one.
 *
 * Kept quiet on purpose. The pattern carries no information, so anything loud
 * enough to compete with the number in front of it is working against the
 * card. Fourteen and seven percent sit at the bottom of the range that reads
 * as deliberate rather than as a rendering fault.
 */

type BrandPatternProps = {
  /** Ink for the lattice. White on a filled brand surface; the sage on white. */
  color?: string;
  /** The stronger of the two chevrons. The second is drawn at half this. */
  opacity?: number;
  /**
   * Tile size. Small tiles on small surfaces: at 44 points a 28 tile shows two
   * repeats and reads as a stripe, where a 12 tile reads as texture.
   */
  tile?: number;
  strokeWidth?: number;
};

export default function BrandPattern({
  color = '#FFFFFF',
  opacity = 0.14,
  tile = 26,
  strokeWidth = 2.4,
}: BrandPatternProps) {
  const half = tile / 2;

  return (
    /**
     * Behind everything and deaf to touch. `pointerEvents="none"` matters:
     * this fills its parent, and without it the pattern would swallow the tap
     * meant for the card underneath.
     */
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="ghandsChevron"
            x="0"
            y="0"
            width={tile}
            height={tile}
            patternUnits="userSpaceOnUse"
          >
            <Path
              d={`M0 ${half} L${half} 0 L${tile} ${half}`}
              stroke={color}
              strokeOpacity={opacity}
              strokeWidth={strokeWidth}
              strokeLinecap="square"
              fill="none"
            />
            {/**
              * The second row, at half strength. Offset by exactly half a tile
              * so the two interlock into a lattice instead of reading as
              * stripes with a gap.
              */}
            <Path
              d={`M0 ${tile} L${half} ${half} L${tile} ${tile}`}
              stroke={color}
              strokeOpacity={opacity / 2}
              strokeWidth={strokeWidth}
              strokeLinecap="square"
              fill="none"
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ghandsChevron)" />
      </Svg>
    </View>
  );
}
