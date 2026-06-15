import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, BorderRadius } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ChevronRight, Check, Key, Lightbulb, Mail, Phone, Shield, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

interface SecurityOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  iconBgColor: string;
  onPress: () => void;
  showToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
}

export default function SecurityScreen() {
  const router = useRouter();
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  const securityOptions: SecurityOption[] = [
    {
      id: '1',
      title: 'Change wallet PIN',
      subtitle: 'Update your 4-digit PIN.',
      icon: Wallet,
      iconBgColor: Colors.accent,
      onPress: () => {
        router.push('/CreatePINScreen' as any);
      },
    },
    {
      id: '2',
      title: 'Change Login Password',
      subtitle: 'Update your account password.',
      icon: Key,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        router.push('/ResetPassword' as any);
      },
    },
    {
      id: '3',
      title: 'Change Phone number',
      subtitle: 'Update your contact number.',
      icon: Phone,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        // Navigate to change phone screen
        // TODO: Create ChangePhoneScreen
      },
    },
    {
      id: '4',
      title: 'Change Email Address',
      subtitle: 'Update your email address.',
      icon: Mail,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        // Navigate to change email screen
        // TODO: Create ChangeEmailScreen
      },
    },
    {
      id: '5',
      title: 'Biometric verification',
      subtitle: 'Use your fingerprint or Face ID.',
      icon: Shield,
      iconBgColor: '#F5F5F5',
      showToggle: true,
      toggleValue: biometricEnabled,
      onToggleChange: setBiometricEnabled,
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Account Security" onBack={() => router.back()} backgroundColor={Colors.white} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 100,
          }}
        >
          {/* Security Options */}
          {securityOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={option.onPress}
                style={{
                  backgroundColor: '#F5F5F5',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: option.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                  }}
                >
                  <IconComponent size={24} color={option.iconBgColor === Colors.accent ? Colors.white : Colors.textPrimary} />
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      marginBottom: 4,
                    }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    {option.subtitle}
                  </Text>
                </View>

                {/* Toggle or Chevron */}
                {option.showToggle ? (
                  <Switch
                    value={option.toggleValue}
                    onValueChange={option.onToggleChange}
                    trackColor={{ false: Colors.border, true: Colors.accent }}
                    thumbColor={Colors.white}
                  />
                ) : (
                  <ChevronRight size={20} color={Colors.textSecondaryDark} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Tips Section */}
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: 12,
              padding: 16,
              marginTop: 8,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Lightbulb size={20} color={Colors.accent} />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  marginLeft: 8,
                }}
              >
                Tips for Custom Services
              </Text>
            </View>

            {/* Tip 1 */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <Check size={16} color={Colors.accent} style={{ marginRight: 12, marginTop: 2 }} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                  lineHeight: 20,
                  flex: 1,
                }}
              >
                Never Share your wallet PIN with anyone. Not even G-Hands support. Your PIN protects your withdrawals and bank details.
              </Text>
            </View>

            {/* Tip 2 */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <Check size={16} color={Colors.accent} style={{ marginRight: 12, marginTop: 2 }} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                  lineHeight: 20,
                  flex: 1,
                }}
              >
                We will never ask for your PIN, Password, or verification code. If you receive suspicious contact, report it immediately through support.
              </Text>
            </View>

            {/* Tip 3 */}
            <View style={{ flexDirection: 'row' }}>
              <Check size={16} color={Colors.accent} style={{ marginRight: 12, marginTop: 2 }} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                  lineHeight: 20,
                  flex: 1,
                }}
              >
                Use fingerprint or face unlock to add an extra layer of security and prevent unauthorized access to your wallet.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
