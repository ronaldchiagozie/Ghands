import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { JOB_TIMELINE } from '@/lib/jobTimelineTheme';
import { Colors } from '@/lib/designSystem';

type SageOutlineChipProps = {
  label: string;
  onPress: () => void;
};

export function SageOutlineChip({ label, onPress }: SageOutlineChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: JOB_TIMELINE.sageOutlineBg,
        borderWidth: 1,
        borderColor: JOB_TIMELINE.sageOutlineBorder,
        minWidth: 76,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Poppins-SemiBold',
          color: JOB_TIMELINE.sage,
        }}
      >
        {label}
      </Text>
      <ChevronRight size={14} color={JOB_TIMELINE.sage} style={{ marginLeft: 2 }} />
    </TouchableOpacity>
  );
}

type SagePrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export function SagePrimaryButton({ label, onPress, disabled, compact }: SagePrimaryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? '#F3F4F6' : JOB_TIMELINE.sage,
        opacity: disabled ? 0.5 : 1,
        paddingVertical: compact ? 9 : 12,
        paddingHorizontal: compact ? 16 : 20,
        borderRadius: 12,
        minWidth: 76,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: compact ? 12 : 14,
          fontFamily: 'Poppins-SemiBold',
          color: disabled ? JOB_TIMELINE.metaText : Colors.white,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type DestructiveButtonProps = {
  label: string;
  onPress: () => void;
  compact?: boolean;
  fullWidth?: boolean;
};

/** Red destructive action — e.g. decline visit */
export function DestructiveButton({ label, onPress, compact, fullWidth }: DestructiveButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        backgroundColor: Colors.error,
        paddingVertical: compact ? 9 : 11,
        paddingHorizontal: compact ? 16 : 14,
        borderRadius: 12,
        minWidth: 76,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: fullWidth ? 'stretch' : undefined,
      }}
    >
      <Text
        style={{
          fontSize: compact ? 12 : 13,
          fontFamily: 'Poppins-SemiBold',
          color: Colors.white,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type NeutralOutlineButtonProps = {
  label: string;
  onPress: () => void;
};

export function NeutralOutlineButton({ label, onPress }: NeutralOutlineButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: JOB_TIMELINE.panelBorder,
        minWidth: 76,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Poppins-SemiBold',
          color: JOB_TIMELINE.metaText,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type InlineActionsRowProps = {
  children: React.ReactNode;
};

export function InlineActionsRow({ children }: InlineActionsRowProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
      {children}
    </View>
  );
}
