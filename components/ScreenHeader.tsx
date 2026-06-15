import { BorderRadius, Colors, MIN_TOUCH_TARGET, SPACING } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { navigateBack } from '@/utils/navigation';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Used when onBack is omitted — safe stack back with fallback route */
  backFallback?: string;
  rightElement?: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
}

/**
 * Shared screen header for consistent layout and styling across the app.
 * Back button meets 44pt minimum touch target. Use rightElement for actions like Bell or Clear all.
 */
export function ScreenHeader({ title, onBack, backFallback, rightElement, backgroundColor = Colors.white, style }: ScreenHeaderProps) {
  const router = useRouter();

  const handleBack = onBack ?? (backFallback ? () => navigateBack(router, backFallback) : undefined);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.xl,
          paddingTop: SPACING.md,
          paddingBottom: SPACING.md,
          backgroundColor,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
        {handleBack ? (
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            style={{
              width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
              borderRadius: BorderRadius.full,
              backgroundColor: Colors.backgroundGray,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: SPACING.md,
            }}
            accessibilityLabel="Go back"
            accessibilityHint="Navigates to the previous screen"
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 18,
            fontFamily: 'Poppins-Bold',
            color: Colors.textPrimary,
            letterSpacing: -0.3,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {rightElement != null ? (
        <View style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'flex-end', justifyContent: 'center' }}>
          {rightElement}
        </View>
      ) : null}
    </View>
  );
}

export default ScreenHeader;
