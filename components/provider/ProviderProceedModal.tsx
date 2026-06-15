import { BorderRadius, Colors, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight, FileText, MapPin, X } from 'lucide-react-native';
import React from 'react';

export type ProviderProceedType = 'visit' | 'quote';

type ProviderProceedModalProps = {
  visible: boolean;
  jobTitle?: string;
  loadingType: ProviderProceedType | null;
  onClose: () => void;
  onSelect: (type: ProviderProceedType) => void;
};

function OptionRow({
  icon: Icon,
  title,
  subtitle,
  accent,
  loading,
  disabled,
  onPress,
}: {
  icon: typeof MapPin;
  title: string;
  subtitle: string;
  accent: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: accent ? Colors.sageTint : Colors.white,
        borderWidth: 1,
        borderColor: accent ? 'rgba(79, 103, 57, 0.35)' : Colors.border,
        borderRadius: BorderRadius.default,
        padding: 14,
        marginBottom: 10,
        opacity: disabled && !loading ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: BorderRadius.sm,
          backgroundColor: accent ? 'rgba(79, 103, 57, 0.12)' : Colors.backgroundGray,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Icon size={18} color={accent ? Colors.accent : Colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary, lineHeight: 20 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 2, lineHeight: 17 }}>
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.accent} />
      ) : (
        <ArrowRight size={16} color={accent ? Colors.accent : Colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

export default function ProviderProceedModal({
  visible,
  jobTitle,
  loadingType,
  onClose,
  onSelect,
}: ProviderProceedModalProps) {
  const busy = loadingType !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' }}
        onPress={busy ? undefined : onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: Colors.white,
            borderTopLeftRadius: BorderRadius.lg,
            borderTopRightRadius: BorderRadius.lg,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 28,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: Colors.border,
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
            <View style={{ flex: 1, paddingRight: 36 }}>
              <Text style={{ fontSize: 18, lineHeight: 24, fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>
                How do you want to proceed?
              </Text>
              {jobTitle ? (
                <Text
                  style={{ fontSize: 13, fontFamily: 'Poppins-Medium', color: Colors.accent, marginTop: 4 }}
                  numberOfLines={2}
                >
                  {jobTitle}
                </Text>
              ) : null}
              <Text style={{ fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 6, lineHeight: 18 }}>
                We&apos;ll accept the job and take you straight to the next step.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                borderRadius: 16,
                backgroundColor: Colors.backgroundGray,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy ? 0.4 : 1,
              }}
            >
              <X size={16} color={Colors.textSecondaryDark} />
            </TouchableOpacity>
          </View>

          <OptionRow
            icon={MapPin}
            title="Request visit"
            subtitle="Schedule an inspection before quoting."
            accent
            loading={loadingType === 'visit'}
            disabled={busy}
            onPress={() => onSelect('visit')}
          />
          <OptionRow
            icon={FileText}
            title="Send quotation"
            subtitle="Skip the visit and send your price now."
            accent={false}
            loading={loadingType === 'quote'}
            disabled={busy}
            onPress={() => onSelect('quote')}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
