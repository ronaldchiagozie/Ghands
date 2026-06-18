import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

const SPARKLE_LIME = '#E4FF5C';
const SPARKLE_BLACK = '#101010';

/** Four-point star — viewBox 0 0 24 24, center at (12, 12). */
const STAR_PATH =
  'M12 1.5L13.8 10.2L22.5 12L13.8 13.8L12 22.5L10.2 13.8L1.5 12L10.2 10.2Z';

type AiSparkleIconProps = {
  variant?: 'default' | 'fab' | 'fab-shoulder' | 'lg';
};

function SparkleStar({
  size,
  fill,
  style,
}: {
  size: number;
  fill: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR_PATH} fill={fill} />
      </Svg>
    </View>
  );
}

/** Star drawn with its center at (x, y) inside the SVG viewBox. */
function CenteredStar({
  x,
  y,
  scale,
  fill,
}: {
  x: number;
  y: number;
  scale: number;
  fill: string;
}) {
  return (
    <G transform={`translate(${x}, ${y})`}>
      <G transform={`translate(-12, -12) scale(${scale})`}>
        <Path d={STAR_PATH} fill={fill} />
      </G>
    </G>
  );
}

/**
 * All sparkles in one SVG — cluster centroid locked to viewBox center (15, 15).
 */
function FabCenterSparkleCluster() {
  const size = 30;

  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <CenteredStar x={15} y={15} scale={0.92} fill={SPARKLE_LIME} />
      <CenteredStar x={21} y={10} scale={0.66} fill={SPARKLE_BLACK} />
      <CenteredStar x={10} y={20} scale={0.56} fill={SPARKLE_LIME} />
    </Svg>
  );
}

/** Shoulder variant — kept for reference layouts. */
export function AiFabShoulderSparkles() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -11,
        left: -9,
        width: 34,
        height: 30,
      }}
    >
      <SparkleStar
        size={22}
        fill={SPARKLE_LIME}
        style={{ position: 'absolute', left: 2, top: 10 }}
      />
      <SparkleStar
        size={16}
        fill={SPARKLE_BLACK}
        style={{ position: 'absolute', left: 10, top: 0 }}
      />
      <SparkleStar
        size={14}
        fill={SPARKLE_LIME}
        style={{ position: 'absolute', left: 16, top: 14 }}
      />
    </View>
  );
}

export default function AiSparkleIcon({ variant = 'default' }: AiSparkleIconProps) {
  if (variant === 'fab' || variant === 'lg') {
    return <FabCenterSparkleCluster />;
  }

  if (variant === 'fab-shoulder') {
    return <AiFabShoulderSparkles />;
  }

  return (
    <View style={{ width: 28, height: 28, position: 'relative' }}>
      <SparkleStar
        size={12}
        fill={SPARKLE_LIME}
        style={{ position: 'absolute', left: 0, top: 1 }}
      />
      <SparkleStar
        size={10}
        fill={SPARKLE_BLACK}
        style={{ position: 'absolute', right: 0, top: 0 }}
      />
      <SparkleStar
        size={9}
        fill={SPARKLE_LIME}
        style={{ position: 'absolute', left: 3, bottom: 0 }}
      />
    </View>
  );
}
