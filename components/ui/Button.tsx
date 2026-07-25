import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { BorderRadius, BUTTON_HEIGHTS, OPACITY, Spacing } from '@/lib/designSystem';
import { ButtonVariant, getButtonVariantStyles } from '@/lib/buttonTheme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  /** Overrides the default accessibility label (title). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}) => {
  const height = BUTTON_HEIGHTS[size];
  const isDisabled = disabled || loading;
  const variantStyles = getButtonVariantStyles(variant, isDisabled);

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm };
      case 'medium':
        return { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md };
      case 'large':
        return { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.lg };
      default:
        return { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md };
    }
  };

  const labelColor = variantStyles.label;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={OPACITY.pressed}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          height,
          borderRadius: BorderRadius.default,
          ...variantStyles.container,
          ...getPadding(),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: fullWidth ? '100%' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={variantStyles.spinner} style={{ marginRight: Spacing.sm }} />
          <Text
            numberOfLines={1}
            style={[
              {
                color: labelColor,
                fontSize: getFontSize(),
                fontFamily: 'Poppins-SemiBold',
                textAlign: 'center',
                flexShrink: 1,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' ? (
            <View style={{ marginRight: Spacing.sm }}>{icon}</View>
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              {
                color: labelColor,
                fontSize: getFontSize(),
                fontFamily: 'Poppins-SemiBold',
                textAlign: 'center',
                flexShrink: 1,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? (
            <View style={{ marginLeft: Spacing.sm }}>{icon}</View>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
};
