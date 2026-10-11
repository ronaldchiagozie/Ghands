import { BorderRadius, Colors, MIN_TOUCH_TARGET, SPACING } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigateBack } from '@/utils/navigation';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Used when onBack is omitted - safe stack back with fallback route */
  backFallback?: string;
  rightElement?: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
  /** Hairline under header when body uses a different background */
  showBottomBorder?: boolean;
  /** The back button's own circle - defaults to the usual light-grey chip. */
  backButtonBackgroundColor?: string;
}

const BACK_ICON_SIZE = 20;

/**
 * Shared screen header for consistent layout and styling across the app.
 * Back button meets 44pt minimum touch target. Use rightElement for actions like Bell or Clear all.
 */
export function ScreenHeader({
  title,
  onBack,
  backFallback,
  rightElement,
  backgroundColor = Colors.white,
  style,
  showBottomBorder = false,
  backButtonBackgroundColor = Colors.backgroundGray,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = onBack ?? (backFallback ? () => navigateBack(router, backFallback) : undefined);

  /**
   * Pulls a chipless back arrow out to the page margin.
   *
   * The tap target is a 44pt circle with a 20pt glyph centred in it, so the
   * arrow itself sits 12pt inside the header's padding. With a grey chip
   * that is right - the chip's edge is the thing lining up with the page.
   * With no chip there is nothing to line up but the arrow, and it ended up
   * visibly further in than every heading beneath it.
   *
   * The offset moves the circle, not the arrow, so the target stays 44pt.
   */
  const chipless = backButtonBackgroundColor === 'transparent';
  const opticalInset = chipless ? -(MIN_TOUCH_TARGET - BACK_ICON_SIZE) / 2 : 0;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.xl,
          paddingTop: insets.top + SPACING.md,
          paddingBottom: SPACING.md,
          marginTop: -insets.top,
          backgroundColor,
        },
        showBottomBorder
          ? { borderBottomWidth: 1, borderBottomColor: Colors.border }
          : null,
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
              backgroundColor: backButtonBackgroundColor,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: opticalInset,
              /** Closed up by the same amount, so the title does not drift left with it. */
              marginRight: SPACING.md + opticalInset,
            }}
            accessibilityLabel="Go back"
            accessibilityHint="Navigates to the previous screen"
          >
            <ArrowLeft size={BACK_ICON_SIZE} color={Colors.textPrimary} />
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
