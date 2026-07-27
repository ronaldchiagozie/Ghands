import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AI_COLORS } from '@/components/ai/aiAssistantTheme';
import AiSparkleIcon from '@/components/icons/AiSparkleIcon';
import { BorderRadius, Colors, TOUCH_HIT_SLOP } from '@/lib/designSystem';

export type HandyChipState = 'idle' | 'pending' | 'filled';

type HandyDraftChipProps = {
  state: HandyChipState;
  onPress: () => void;
  onUndo: () => void;
  disabled?: boolean;
};

/**
 * Sits on a field's label row rather than inside the input — an absolutely
 * positioned control would sit on top of the description text.
 */
export default function HandyDraftChip({
  state,
  onPress,
  onUndo,
  disabled = false,
}: HandyDraftChipProps) {
  const pending = state === 'pending';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {state === 'filled' ? (
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo Handy draft"
          hitSlop={TOUCH_HIT_SLOP}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.textMuted }}>
            Undo
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onPress}
        disabled={disabled || pending}
        accessibilityRole="button"
        accessibilityLabel={pending ? 'Handy is drafting' : 'Draft with Handy'}
        accessibilityHint="Fills the job title and description with a suggestion you can edit"
        accessibilityState={{ disabled: disabled || pending, busy: pending }}
        hitSlop={TOUCH_HIT_SLOP}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: BorderRadius.full,
          borderWidth: 1,
          borderColor: Colors.borderSage,
          backgroundColor: Colors.sageTint,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        })}
      >
        {/* Fixed slot so the chip keeps its height when the spinner swaps in. */}
        <View style={{ width: 15, height: 15, alignItems: 'center', justifyContent: 'center' }}>
          {pending ? (
            <ActivityIndicator
              size="small"
              color={AI_COLORS.screenBase}
              style={{ transform: [{ scale: 0.75 }] }}
            />
          ) : (
            <AiSparkleIcon variant="chip" size={15} />
          )}
        </View>
        <Text
          style={{
            fontFamily: 'Poppins-Medium',
            fontSize: 12,
            lineHeight: 17,
            color: AI_COLORS.screenBase,
          }}
        >
          {pending ? 'Drafting…' : 'Handy'}
        </Text>
      </Pressable>
    </View>
  );
}
