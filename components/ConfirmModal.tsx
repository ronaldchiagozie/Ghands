import { BorderRadius, Colors } from '@/lib/designSystem';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const MODAL_ACTION_BTN = {
  flex: 1,
  minHeight: 48,
  paddingVertical: 14,
  paddingHorizontal: 12,
  borderRadius: BorderRadius.default,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmBackgroundColor?: string;
  confirmTextColor?: string;
  loading?: boolean;
  singleAction?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmBackgroundColor = Colors.accent,
  confirmTextColor = '#FFFFFF',
  loading = false,
  singleAction = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: Colors.white,
            borderRadius: BorderRadius.lg,
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>
          <View
            style={
              singleAction
                ? { width: '100%' }
                : { flexDirection: 'row', alignItems: 'stretch', gap: 12 }
            }
          >
            {!singleAction ? (
              <TouchableOpacity
                onPress={onCancel}
                disabled={loading}
                style={[MODAL_ACTION_BTN, { backgroundColor: '#F3F4F6' }]}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              style={[
                MODAL_ACTION_BTN,
                { backgroundColor: confirmBackgroundColor },
                singleAction ? null : { flex: 1 },
                loading ? { opacity: 0.85 } : null,
              ]}
              activeOpacity={0.8}
            >
              {loading && !singleAction ? (
                <ActivityIndicator color={confirmTextColor} size="small" />
              ) : (
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: confirmTextColor }}>
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
