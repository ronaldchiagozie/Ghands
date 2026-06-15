import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors } from '@/lib/designSystem';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Camera, Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ValidationState {
  cardNumber: boolean | null;
  expiration: boolean | null;
  cvc: boolean | null;
  zipCode: boolean | null;
}

export default function AddCardDetailsScreen() {
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState('');
  const [expiration, setExpiration] = useState('');
  const [cvc, setCvc] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [validation, setValidation] = useState<ValidationState>({
    cardNumber: null,
    expiration: null,
    cvc: null,
    zipCode: null,
  });

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const formatExpiration = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const validateCardNumber = (text: string): boolean => {
    const cleaned = text.replace(/\s/g, '');
    return cleaned.length >= 13 && cleaned.length <= 19 && /^\d+$/.test(cleaned);
  };

  const validateExpiration = (text: string): boolean => {
    const match = text.match(/(\d{2})\/(\d{2})/);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    return month >= 1 && month <= 12 && year >= 0 && year <= 99;
  };

  const validateCVC = (text: string): boolean => {
    return text.length === 3 && /^\d+$/.test(text);
  };

  const validateZipCode = (text: string): boolean => {
    return text.length >= 3;
  };

  const handleCardNumberChange = (text: string) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted);
    if (formatted.length > 0) {
      setValidation(prev => ({
        ...prev,
        cardNumber: validateCardNumber(formatted),
      }));
    } else {
      setValidation(prev => ({ ...prev, cardNumber: null }));
    }
  };

  const handleExpirationChange = (text: string) => {
    const formatted = formatExpiration(text);
    setExpiration(formatted);
    if (formatted.length > 0) {
      setValidation(prev => ({
        ...prev,
        expiration: validateExpiration(formatted),
      }));
    } else {
      setValidation(prev => ({ ...prev, expiration: null }));
    }
  };

  const handleCVCChange = (text: string) => {
    setCvc(text);
    if (text.length > 0) {
      setValidation(prev => ({
        ...prev,
        cvc: validateCVC(text),
      }));
    } else {
      setValidation(prev => ({ ...prev, cvc: null }));
    }
  };

  const handleZipCodeChange = (text: string) => {
    setZipCode(text);
    if (text.length > 0) {
      setValidation(prev => ({
        ...prev,
        zipCode: validateZipCode(text),
      }));
    } else {
      setValidation(prev => ({ ...prev, zipCode: null }));
    }
  };

  const getBorderColor = (isValid: boolean | null): string => {
    if (isValid === null) return Colors.border;
    return isValid ? '#10B981' : Colors.errorBright;
  };

  const isFormValid = () => {
    return (
      validation.cardNumber === true &&
      validation.expiration === true &&
      validation.cvc === true &&
      validation.zipCode === true
    );
  };

  const handleSave = () => {
    if (isFormValid()) {
      router.back();
      // Handle save card logic
    }
  };

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View style={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text 
              className="text-xl font-bold text-black" 
              style={{ fontFamily: 'Poppins-Bold' }}
            >
              Add card details
            </Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <ScrollView 
          className="flex-1 px-4" 
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Number */}
          <View className="mb-6">
            <Text 
              className="text-sm text-gray-700 mb-2" 
              style={{ fontFamily: 'Poppins-Medium' }}
            >
              Card Number
            </Text>
            <View className="relative">
              <TextInput
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                placeholder="1234 5678 9101 1121"
                placeholderTextColor={Colors.placeholder}
                keyboardType="numeric"
                maxLength={19}
                className="border rounded-xl px-4 py-4 text-base"
                style={{
                  fontFamily: 'Poppins-Regular',
                  borderColor: getBorderColor(validation.cardNumber),
                  borderWidth: 1,
                }}
              />
              <TouchableOpacity
                className="absolute right-4 top-0 bottom-0 justify-center"
                activeOpacity={0.7}
              >
                <Camera size={20} color={Colors.iconMuted} />
              </TouchableOpacity>
            </View>
            {validation.cardNumber === false && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="alert-circle" size={16} color={Colors.errorBright} />
                <Text 
                  className="text-red-500 text-sm ml-2" 
                  style={{ fontFamily: 'Poppins-Regular' }}
                >
                  Invalid card number
                </Text>
              </View>
            )}
          </View>

          {/* Expiration and CVC Row */}
          <View className="flex-row mb-6" style={{ gap: 12 }}>
            <View className="flex-1">
              <Text 
                className="text-sm text-gray-700 mb-2" 
                style={{ fontFamily: 'Poppins-Medium' }}
              >
                Expiration
              </Text>
              <TextInput
                value={expiration}
                onChangeText={handleExpirationChange}
                placeholder="MM/YY"
                placeholderTextColor={Colors.placeholder}
                keyboardType="numeric"
                maxLength={5}
                className="border rounded-xl px-4 py-4 text-base"
                style={{
                  fontFamily: 'Poppins-Regular',
                  borderColor: getBorderColor(validation.expiration),
                  borderWidth: 1,
                }}
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text 
                  className="text-sm text-gray-700" 
                  style={{ fontFamily: 'Poppins-Medium' }}
                >
                  CVC
                </Text>
                <TouchableOpacity className="ml-1" activeOpacity={0.7}>
                  <Info size={14} color={Colors.iconMuted} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={cvc}
                onChangeText={handleCVCChange}
                placeholder="123"
                placeholderTextColor={Colors.placeholder}
                keyboardType="numeric"
                maxLength={3}
                className="border rounded-xl px-4 py-4 text-base"
                style={{
                  fontFamily: 'Poppins-Regular',
                  borderColor: getBorderColor(validation.cvc),
                  borderWidth: 1,
                }}
              />
            </View>
          </View>

          {/* Zip Code */}
          <View className="mb-8">
            <Text 
              className="text-sm text-gray-700 mb-2" 
              style={{ fontFamily: 'Poppins-Medium' }}
            >
              Zip code
            </Text>
            <TextInput
              value={zipCode}
              onChangeText={handleZipCodeChange}
              placeholder="ZIP"
              placeholderTextColor={Colors.placeholder}
              className="border rounded-xl px-4 py-4 text-base"
              style={{
                fontFamily: 'Poppins-Regular',
                borderColor: getBorderColor(validation.zipCode),
                borderWidth: 1,
              }}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isFormValid()}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center justify-center ${
              isFormValid() ? 'bg-black' : 'bg-gray-300'
            }`}
          >
            <Text 
              className={`text-base font-semibold ${
                isFormValid() ? 'text-white' : 'text-gray-500'
              }`}
              style={{ fontFamily: 'Poppins-SemiBold' }}
            >
              Save
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

