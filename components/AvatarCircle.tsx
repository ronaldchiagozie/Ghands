import { User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/lib/designSystem';
import { isDisplayableAvatarUri } from '@/utils/clientProfilePhoto';

type AvatarCircleProps = {
  uri?: string | null;
  size?: number;
  borderColor?: string;
  backgroundColor?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

/** Profile / provider avatar — photo when valid, otherwise a person icon (never stock category art). */
export function AvatarCircle({
  uri,
  size = 38,
  borderColor = Colors.border,
  backgroundColor = Colors.backgroundGray,
  iconColor = Colors.iconMuted,
  style,
}: AvatarCircleProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const trimmed = typeof uri === 'string' ? uri.trim() : '';
  const showPhoto = isDisplayableAvatarUri(trimmed) && !loadFailed;

  useEffect(() => {
    setLoadFailed(false);
  }, [trimmed]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor,
          borderWidth: 1,
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
      ) : (
        <User size={Math.round(size * 0.5)} color={iconColor} />
      )}
    </View>
  );
}
