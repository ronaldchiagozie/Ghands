import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, BUTTON_HEIGHTS, OPACITY } from '@/lib/designSystem';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: Colors.accent,
          borderWidth: 0,
          borderColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: Colors.black,
          borderWidth: 0,
          borderColor: 'transparent',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: Colors.accent,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: Colors.error,
          borderWidth: 0,
          borderColor: 'transparent',
        };
      default:
        return {
          backgroundColor: Colors.accent,
          borderWidth: 0,
          borderColor: 'transparent',
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        return Colors.white;
      case 'outline':
      case 'ghost':
        return Colors.accent;
      default:
        return Colors.white;
    }
  };

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
          ...getVariantStyles(),
          ...getPadding(),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? OPACITY.disabled : 1,
          width: fullWidth ? '100%' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Text style={{ marginRight: Spacing.sm }}>{icon}</Text>
          )}
          <Text
            numberOfLines={1}
            style={[
              {
                color: getTextColor(),
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
          {icon && iconPosition === 'right' && (
            <Text style={{ marginLeft: Spacing.sm }}>{icon}</Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

