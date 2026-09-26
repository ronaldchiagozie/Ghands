import { Building2 } from 'lucide-react-native';
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Marks an account as a company wherever its name is shown, so a provider can
 * tell a business booking from a household one at a glance. Plain on purpose:
 * a label, not a status - no fill colour to compete with job states.
 * Identical in both apps.
 */
export function CompanyBadge({
  label = 'Company',
  tone = 'light',
  style,
}: {
  label?: string;
  /** `dark` for sitting on the green hero panels. */
  tone?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  const ink = tone === 'dark' ? '#FFFFFF' : '#374151';
  return (
    <View
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tone === 'dark' ? 'rgba(255,255,255,0.35)' : '#E5E7EB',
          backgroundColor: tone === 'dark' ? 'rgba(255,255,255,0.12)' : '#F9FAFB',
        },
        style,
      ]}
    >
      <Building2 size={11} color={ink} strokeWidth={2} />
      <Text style={{ fontSize: 10.5, lineHeight: 15, fontFamily: 'Poppins-SemiBold', color: ink }}>{label}</Text>
    </View>
  );
}
