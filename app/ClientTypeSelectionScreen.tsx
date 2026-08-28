import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { recordSignupStep } from '@/utils/signupProgress';
import { Colors } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { Building2, User, Users } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { AccountTypeCard } from '../components/AccountTypeCard';
import { haptics } from '@/hooks/useHaptics';
import { setClientAccountType } from '@/utils/clientAccountType';

export default function ClientTypeSelectionScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleIndividualClient = async () => {
    haptics.selection();
    await setClientAccountType('individual');
    router.push('/SignupScreen');
  };

  const handleCompanyClient = async () => {
    haptics.selection();
    await setClientAccountType('company');
    router.push('/CompanySignupScreen');
  };

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: Colors.backgroundLight }}>
      <SafeAreaWrapper>
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Icon */}
          <Animated.View
            style={[
              {
                alignItems: 'center',
                marginTop: 40,
                marginBottom: 32,
              },
              animatedStyle,
            ]}
          >
            <View
              style={{
                width: 160,
                height: 160,
                backgroundColor: Colors.accent,
                borderRadius: 80,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 0.76,
              }}
            >
              <Users size={60} color={Colors.white} />
            </View>
          </Animated.View>

          <Animated.View
            style={[
              {
                flex: 0,
                justifyContent: 'center',
                paddingHorizontal: 20,
                paddingBottom: 32,
              },
              animatedStyle,
            ]}
          >
            <Text
              style={{
                fontSize: 18,
                lineHeight: 24,
                textAlign: 'left',
                marginBottom: 24,
                color: Colors.textPrimary,
                fontFamily: 'Poppins-Bold',
              }}
            >
              Choose Your Account Type
            </Text>

            {/* Individual Client Card */}
            <View style={{ marginBottom: 16 }}>
              <AccountTypeCard
                icon={<User size={32} color={Colors.accent} />}
                title="Individual Client"
                subtitle="Personal service requests"
                tags={["Personal", "Quick", "Easy"]}
                onPress={handleIndividualClient}
              />
            </View>

            {/* Company Client Card */}
            <AccountTypeCard
              icon={<Building2 size={32} color={Colors.accent} />}
              title="Company Client"
              subtitle="Business service solutions"
              tags={["Business", "Professional", "Managed"]}
              onPress={handleCompanyClient}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaWrapper>
    </Animated.View>
  );
}
