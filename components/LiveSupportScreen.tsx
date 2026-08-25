import { MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';

const LiveSupportScreen = () => {
  const router = useRouter();

  const handleStartChat = () => {
    router.push('/LiveChatScreen' as any);
  };

  return (
    <View style={{ paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER, marginTop: 4, marginBottom: 14 }}>
      <View
        style={{
          backgroundColor: '#FAFCF7',
          borderRadius: 22,
          padding: 18,
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.025,
          shadowRadius: 16,
          elevation: 0.76,
        }}
      >
        <View className='flex-row items-center mb-3'>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#F2F7EC',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <MessageCircle size={18} color="#4F6739" />
          </View>
          <View style={{ flex: 1 }}>
            <Text 
              className='text-base font-bold text-black' 
              style={{ fontFamily: 'Poppins-Bold' }}
            >
              Need help?
            </Text>
            <Text 
              className='text-gray-500 text-xs' 
              style={{ fontFamily: 'Poppins-Regular', marginTop: 1 }}
            >
              Chat with support anytime.
            </Text>
          </View>
        </View>
        <Text 
          className='text-gray-600 text-sm mb-4' 
          style={{ fontFamily: 'Poppins-Regular', lineHeight: 20 }}
        >
          Get answers about bookings, payments, providers, and job updates.
        </Text>
        <TouchableOpacity 
          className='rounded-xl py-3 px-6 items-center'
          style={{ backgroundColor: '#111827' }}
          onPress={handleStartChat}
          activeOpacity={0.85}
        >
          <Text 
            className='text-white font-semibold' 
            style={{ fontFamily: 'Poppins-SemiBold' }}
          >
            Start chat
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default LiveSupportScreen;