import { User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/lib/designSystem';
import { isDisplayableAvatarUri } from '@/utils/clientProfilePhoto';

type AvatarCircleProps = {
  uri?: string | null;
  /** Used for initials when there is no photo. Worth passing wherever it is known. */
  name?: string | null;
  size?: number;
  borderColor?: string;
  backgroundColor?: string;
  iconColor?: string;
  /** Initials colour. Override on dark surfaces, where the sage default is unreadable. */
  textColor?: string;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pulls one or two initials out of a display name.
 *
 * Skips the things Nigerian names and directory data routinely carry that are
 * not part of someone's name — honorifics, and the trade suffix providers tend
 * to append ("Musa Ibrahim Plumbing"). "Mr Musa Ibrahim" should read MI, not MM.
 */
const NON_NAME_WORDS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'engr', 'esq', 'chief', 'alhaji', 'alhaja',
  'ltd', 'limited', 'services', 'service', 'and', 'the',
]);

export function getAvatarInitials(name?: string | null): string {
  if (typeof name !== 'string') return '';

  const words = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !NON_NAME_WORDS.has(word.toLowerCase().replace(/[.'-]/g, '')));

  if (words.length === 0) return '';

  const letters = words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('');

  return letters.toLocaleUpperCase();
}

/**
 * A person's avatar: their photo, else their initials, else a neutral glyph.
 *
 * Never category art. Provider photos are missing often enough that the
 * fallback is what most people actually see, and the app had been using
 * plumbericon2.png for it — so a carpenter with no photo was shown holding a
 * wrench, and so was every customer in the chat list. The initials are the
 * ordinary fix, and they carry real information: you can tell two providers
 * apart in a list, which a repeated glyph cannot do.
 *
 * One brand tint rather than a colour per person. A hashed palette is common,
 * but it reads as decoration next to a map already carrying category colours.
 */
export function AvatarCircle({
  uri,
  name,
  size = 38,
  borderColor = Colors.border,
  backgroundColor,
  iconColor = Colors.iconMuted,
  textColor = Colors.successForeground,
  borderWidth = 1,
  style,
}: AvatarCircleProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  const showPhoto = isDisplayableAvatarUri(trimmed) && !loadFailed;
  const initials = showPhoto ? '' : getAvatarInitials(name);

  useEffect(() => {
    setLoadFailed(false);
  }, [trimmed]);

  const fill =
    backgroundColor ?? (initials ? Colors.successLight : Colors.backgroundGray);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: fill,
          borderWidth,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: trimmed }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setLoadFailed(true)}
        />
      ) : initials ? (
        <Text
          allowFontScaling={false}
          style={{
            /**
             * Not scaled by the accessibility text setting: the circle is a fixed
             * size, so larger text would simply be clipped. The glyph fallback
             * has the same constraint.
             */
            fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.44)),
            lineHeight: Math.round(size * (initials.length > 1 ? 0.44 : 0.52)),
            fontFamily: 'Poppins-SemiBold',
            color: textColor,
            letterSpacing: 0.2,
          }}
        >
          {initials}
        </Text>
      ) : (
        <User size={Math.round(size * 0.5)} color={iconColor} />
      )}
    </View>
  );
}
