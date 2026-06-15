import React, { ReactNode, useState, useEffect, forwardRef, useId } from 'react';
import { KeyboardTypeOptions, TextInput, TouchableOpacity, View, Text } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, INPUT_HEIGHTS, TOUCH_HIT_SLOP } from '@/lib/designSystem';

interface InputFieldProps {
  placeholder: string;
  /** Visible label and default screen-reader name when accessibilityLabel is omitted. */
  label?: string;
  /** Overrides label/placeholder for VoiceOver and TalkBack. */
  accessibilityLabel?: string;
  icon: ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  value: string;
  onChangeText: (text: string) => void;
  iconPosition?: 'left' | 'right';
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  showCharCount?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  returnKeyType?: 'done' | 'next' | 'search' | 'send' | 'go';
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}

export const InputField = forwardRef<TextInput, InputFieldProps>((props, ref) => {
  const {
    placeholder,
    label,
    accessibilityLabel,
    icon,
    secureTextEntry = false,
    keyboardType = 'default',
    value,
    onChangeText,
    iconPosition = 'left',
    error = false,
    errorMessage,
    disabled = false,
    autoCapitalize = 'sentences',
    maxLength,
    showCharCount = false,
    onBlur,
    onFocus,
    returnKeyType = 'done',
    onSubmitEditing,
    autoFocus = false,
  } = props;
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const labelNativeId = `input-field-label-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (value.length > 0) {
      setHasInteracted(true);
    }
  }, [value]);

  const showError = error && hasInteracted;
  const charCount = maxLength ? value.length : null;
  const remainingChars = maxLength ? maxLength - value.length : null;
  const isPasswordField = secureTextEntry;
  const showLeftIcon = !!icon && (iconPosition === 'left' || isPasswordField);
  const showRightDecorIcon = !!icon && iconPosition === 'right' && !isPasswordField;

  const iconSize = 36;
  const inputMinHeight = INPUT_HEIGHTS.small;
  const fieldName = accessibilityLabel ?? label ?? placeholder;

  return (
    <View style={{ marginBottom: Spacing.md }}>
      {label ? (
        <Text
          nativeID={labelNativeId}
          accessibilityRole="text"
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Medium',
            color: Colors.textPrimary,
            marginBottom: Spacing.xs,
            paddingHorizontal: Spacing.sm,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: Colors.backgroundGray,
          borderRadius: BorderRadius.default,
          paddingHorizontal: Spacing.md,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: inputMinHeight,
          borderWidth: showError || isFocused ? 2 : 0,
          borderColor: showError ? Colors.error : isFocused ? Colors.accent : 'transparent',
          opacity: disabled ? 0.6 : 1,
        }}
      >
      {showLeftIcon && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: iconSize,
            height: iconSize,
            marginRight: Spacing.md,
            backgroundColor: Colors.accent,
            borderRadius: BorderRadius.default,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      )}
      <TextInput
        ref={ref}
        placeholder={placeholder}
        secureTextEntry={isPasswordField ? !passwordVisible : false}
        keyboardType={keyboardType}
        value={value}
        onChangeText={(text) => {
          setHasInteracted(true);
          onChangeText(text);
        }}
        editable={!disabled}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        accessibilityLabel={label ? undefined : fieldName}
        accessibilityLabelledBy={label ? labelNativeId : undefined}
        accessibilityHint={showError && errorMessage ? errorMessage : undefined}
        accessibilityState={{ disabled }}
        style={{
          flex: 1,
          minWidth: 0,
          color: Colors.textPrimary,
          fontSize: 15,
          fontFamily: 'Poppins-Medium',
        }}
        placeholderTextColor={Colors.placeholder}
      />
      {isPasswordField && (
        <TouchableOpacity
          onPress={() => setPasswordVisible((visible) => !visible)}
          hitSlop={TOUCH_HIT_SLOP}
          style={{
            padding: 4,
            marginLeft: Spacing.sm,
          }}
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
        >
          {passwordVisible ? (
            <EyeOff size={20} color={Colors.textSecondaryDark} />
          ) : (
            <Eye size={20} color={Colors.textSecondaryDark} />
          )}
        </TouchableOpacity>
      )}
      {showRightDecorIcon && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: iconSize,
            height: iconSize,
            marginLeft: Spacing.md,
            backgroundColor: Colors.accent,
            borderRadius: BorderRadius.default,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      )}
      </View>
      
      {/* Error Message and Character Count */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginTop: showError || showCharCount ? Spacing.xs : 0,
          marginBottom: showError || showCharCount ? Spacing.xs : 0,
          paddingHorizontal: Spacing.sm,
        }}
      >
        {showError && errorMessage && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{
              flex: 1,
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: Colors.error,
            }}
          >
            {errorMessage}
          </Text>
        )}
        {showCharCount && maxLength && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: remainingChars && remainingChars < 10 ? Colors.error : Colors.textSecondaryDark,
              marginLeft: showError ? Spacing.sm : 0,
            }}
          >
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
});

InputField.displayName = 'InputField';