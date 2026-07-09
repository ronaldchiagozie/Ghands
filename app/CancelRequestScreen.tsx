import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing } from '@/lib/designSystem';

const REASONS = [
  'Service Unavailable',
  'Timing issue',
  'Better match found',
  'Others (Please specify)',
];

export default function CancelRequestScreen() {
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [additionalNote, setAdditionalNote] = useState('');

  const handleSubmit = () => {
    router.replace({
      pathname: '/(tabs)/jobs',
      params: { initialTab: 'Pending' },
    } as any);
  };

  return (
    <SafeAreaWrapper>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
            }}
          >
            Why did you cancel?
          </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={{ fontSize: 24, color: Colors.textPrimary }}>×</Text>
          </TouchableOpacity>
        </View>
        <Text
          style={{
            fontSize: 14,
            fontFamily: 'Poppins-Regular',
            color: Colors.textSecondaryDark,
            marginBottom: 24,
          }}
        >
          Help us improve by sharing your reason
        </Text>

        {REASONS.map((reason) => {
          const isActive = selectedReason === reason;
          return (
            <TouchableOpacity
              key={reason}
              onPress={() => setSelectedReason(reason)}
              className="flex-row items-center justify-between border border-gray-200 rounded-2xl px-4 py-4 mb-3"
              activeOpacity={0.85}
            >
              <Text className="text-base text-black" style={{ fontFamily: 'Poppins-Medium' }}>
                {reason}
              </Text>
              <View className={`w-6 h-6 rounded-full border-2 ${isActive ? 'border-black' : 'border-gray-300'} items-center justify-center`}>
                {isActive && <View className="w-3 h-3 rounded-full bg-black" />}
              </View>
            </TouchableOpacity>
          );
        })}

        {selectedReason === 'Others (Please specify)' && (
          <TextInput
            placeholder="Share more details"
            value={additionalNote}
            onChangeText={setAdditionalNote}
            multiline
            className="border border-gray-200 rounded-2xl px-4 py-3 text-sm text-black mb-5"
            style={{ fontFamily: 'Poppins-Regular', minHeight: 100, textAlignVertical: 'top' }}
          />
        )}

        <View style={{ marginBottom: 16 }}>
          <Button
            title="Submit"
            onPress={handleSubmit}
            variant="secondary"
            size="large"
            fullWidth
          />
        </View>

        <Button
          title="Back"
          onPress={() => router.back()}
          variant="ghost"
          size="large"
          fullWidth
        />

        <Text className="text-xs text-center text-gray-400 mt-4" style={{ fontFamily: 'Poppins-Regular' }}>
          Your feedback is anonymous
        </Text>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
