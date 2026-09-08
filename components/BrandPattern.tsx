import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

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

/**
 * Which geometry. One per card, so a scrolling row reads as a set of distinct
 * things rather than the same card in four colours - the pattern does the
 * separating that colour alone would have to shout to achieve.
 */
export type BrandPatternVariant = 'chevron' | 'dots' | 'question' | 'diagonal' | 'plus';

type BrandPatternProps = {
  variant?: BrandPatternVariant;
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
  variant = 'chevron',
  color = '#FFFFFF',
  opacity = 0.14,
  tile = 26,
  strokeWidth = 2.4,
}: BrandPatternProps) {
  const half = tile / 2;
  const line = {
    stroke: color,
    strokeOpacity: opacity,
    strokeWidth,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };

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
            id="ghandsPattern"
            x="0"
            y="0"
            width={tile}
            height={tile}
            patternUnits="userSpaceOnUse"
          >
            {variant === 'chevron' ? (
              <>
                <Path
                  d={`M0 ${half} L${half} 0 L${tile} ${half}`}
                  {...line}
                  strokeLinecap="square"
                />
                {/**
                  * The second row, at half strength. Offset by exactly half a
                  * tile so the two interlock into a lattice instead of reading
                  * as stripes with a gap.
                  */}
                <Path
                  d={`M0 ${tile} L${half} ${half} L${tile} ${tile}`}
                  {...line}
                  strokeOpacity={opacity / 2}
                  strokeLinecap="square"
                />
              </>
            ) : null}

            {/** Two per tile, offset diagonally, so it never lines up into rows. */}
            {variant === 'dots' ? (
              <>
                <Circle cx={half * 0.5} cy={half * 0.5} r={strokeWidth} fill={color} fillOpacity={opacity} />
                <Circle cx={half * 1.5} cy={half * 1.5} r={strokeWidth} fill={color} fillOpacity={opacity / 1.6} />
              </>
            ) : null}

            {/**
              * A question mark, for the card that answers questions. Drawn as
              * a hook and a dot rather than set as text, because a glyph would
              * bring a font's own proportions into a pattern built from the
              * app's.
              */}
            {variant === 'question' ? (
              <G transform={`translate(${half * 0.45}, ${half * 0.4}) scale(${tile / 34})`}>
                <Path d="M2 5 a5 5 0 1 1 6 4.8 v3.2" {...line} strokeWidth={strokeWidth * 0.9} />
                <Circle cx={8} cy={17} r={strokeWidth * 0.75} fill={color} fillOpacity={opacity} />
              </G>
            ) : null}

            {/** One stroke, drawn three times, so the tile edges join seamlessly. */}
            {variant === 'diagonal' ? (
              <>
                <Path d={`M0 ${tile} L${tile} 0`} {...line} />
                <Path d={`M${-half} ${half} L${half} ${-half}`} {...line} strokeOpacity={opacity / 1.8} />
                <Path d={`M${half} ${tile + half} L${tile + half} ${half}`} {...line} strokeOpacity={opacity / 1.8} />
              </>
            ) : null}

            {variant === 'plus' ? (
              <>
                <Path d={`M${half * 0.5} ${half * 0.2} v${half * 0.6} M${half * 0.2} ${half * 0.5} h${half * 0.6}`} {...line} />
                <Path
                  d={`M${half * 1.5} ${half * 1.2} v${half * 0.6} M${half * 1.2} ${half * 1.5} h${half * 0.6}`}
                  {...line}
                  strokeOpacity={opacity / 1.7}
                />
              </>
            ) : null}
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ghandsPattern)" />
      </Svg>
    </View>
  );
}
