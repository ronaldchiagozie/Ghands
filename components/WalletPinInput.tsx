import { BorderRadius, Colors } from '@/lib/designSystem';
import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

const CELL_SIZE = 60;
const CELL_GAP = 12;

type WalletPinInputProps = {
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
};

/** Stable 4-digit PIN — single hidden field + fixed cells (avoids focus/box jitter). */
export function WalletPinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
}: WalletPinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const pin = value.replace(/\D/g, '').slice(0, 4);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const handleChange = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, 4);
    onChange(next);
    if (next.length === 4) {
      onComplete?.(next);
    }
  };

  return (
    <View>
      <TextInput
        ref={inputRef}
        value={pin}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={4}
        editable={!disabled}
        caretHidden
        secureTextEntry
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="no"
        style={{
          position: 'absolute',
          opacity: 0,
          width: 1,
          height: 1,
          left: -9999,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: CELL_GAP,
        }}
      >
        {[0, 1, 2, 3].map((index) => {
          const filled = pin.length > index;
          return (
            <Pressable
              key={index}
              onPress={() => !disabled && inputRef.current?.focus()}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: BorderRadius.default,
                borderWidth: 2,
                borderColor: error ? Colors.error : filled ? Colors.accent : Colors.border,
                backgroundColor: Colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  lineHeight: 32,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  textAlign: 'center',
                  includeFontPadding: false,
                }}
              >
                {filled ? '•' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
