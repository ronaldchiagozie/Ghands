import { Colors } from '@/lib/designSystem';
import type { ViewStyle } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'muted';

export type ButtonVariantStyles = {
  container: Pick<ViewStyle, 'backgroundColor' | 'borderWidth' | 'borderColor'>;
  label: string;
  spinner: string;
  icon: string;
};

/** App buttons — primary: sage green + white text; secondary: black (destructive/emphasis). */
export function getButtonVariantStyles(
  variant: ButtonVariant,
  disabled: boolean,
): ButtonVariantStyles {
  if (disabled) {
    return {
      container: {
        backgroundColor: Colors.backgroundGray,
        borderWidth: 0,
        borderColor: 'transparent',
      },
      label: Colors.textTertiary,
      spinner: Colors.textSecondaryDark,
      icon: Colors.textTertiary,
    };
  }

  switch (variant) {
    case 'secondary':
      return {
        container: {
          backgroundColor: Colors.black,
          borderWidth: 0,
          borderColor: 'transparent',
        },
        label: Colors.white,
        spinner: Colors.white,
        icon: Colors.white,
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: Colors.accent,
        },
        label: Colors.accent,
        spinner: Colors.accent,
        icon: Colors.accent,
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
        },
        label: Colors.accent,
        spinner: Colors.accent,
        icon: Colors.accent,
      };
    case 'danger':
      return {
        container: {
          backgroundColor: Colors.error,
          borderWidth: 0,
          borderColor: 'transparent',
        },
        label: Colors.white,
        spinner: Colors.white,
        icon: Colors.white,
      };
    case 'muted':
      return {
        container: {
          backgroundColor: Colors.borderLight,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        label: Colors.textSecondaryDark,
        spinner: Colors.textSecondaryDark,
        icon: Colors.textSecondaryDark,
      };
    case 'primary':
    default:
      return {
        container: {
          backgroundColor: Colors.accent,
          borderWidth: 0,
          borderColor: 'transparent',
        },
        label: Colors.white,
        spinner: Colors.white,
        icon: Colors.white,
      };
  }
}
