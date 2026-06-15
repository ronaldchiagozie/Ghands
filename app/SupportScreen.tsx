import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChevronDown, Mail, Phone, Search } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'How do I cancel my subscription?',
    answer:
      'To cancel your subscription, go to your account settings, select "Subscription", and click "Cancel Subscription". Your subscription will remain active until the end of the current billing period.',
  },
  {
    id: '2',
    question: 'How do I update my payment method?',
    answer:
      'You can update your payment method by going to Account Information > Payment Information. From there, you can add, edit, or remove payment methods.',
  },
  {
    id: '3',
    question: 'How do I contact a service provider?',
    answer:
      'You can contact a service provider directly through the chat feature in your job details. Simply tap the chat icon next to the provider\'s name.',
  },
  {
    id: '4',
    question: 'What if I need to reschedule a job?',
    answer:
      'To reschedule a job, go to your Jobs tab, select the ongoing job, and use the "Reschedule" option. You can also contact the provider directly to coordinate a new time.',
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  
  // Initialize animations for each FAQ item
  const animations = useRef<{ [key: string]: Animated.Value }>(
    FAQ_ITEMS.reduce((acc, item) => {
      acc[item.id] = new Animated.Value(0);
      return acc;
    }, {} as { [key: string]: Animated.Value })
  );

  const toggleFAQ = (id: string) => {
    const isExpanded = expandedItems.has(id);
    const newExpanded = new Set(expandedItems);

    if (isExpanded) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }

    setExpandedItems(newExpanded);

    // Animate expansion/collapse
    Animated.timing(animations.current[id], {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleStartLiveChat = () => {
    router.push('/LiveChatScreen' as any);
  };

  const handleSubmitForm = () => {
    if (formData.name && formData.email && formData.message) {
      // Handle form submission
      setFormData({ name: '', email: '', message: '' });
    }
  };

  const filteredFAQs = FAQ_ITEMS.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScreenHeader title="Support" onBack={() => router.back()} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Search Bar */}
          <View className="px-4 pt-6 mb-6">
            <View className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center">
              <TextInput
                placeholder="Search for help..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-black text-base"
                placeholderTextColor={Colors.placeholder}
                style={{ fontFamily: 'Poppins-Regular' }}
              />
              <TouchableOpacity className="bg-[#4F6739] rounded-lg p-2 ml-2">
                <Search size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* FAQ Section */}
          <View className="px-4 mb-6">
            {filteredFAQs.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const animation = animations.current[item.id];
              const rotate = animation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
              });

              return (
                <View key={item.id} className="mb-3">
                  <TouchableOpacity
                    onPress={() => toggleFAQ(item.id)}
                    activeOpacity={0.85}
                    className="bg- border-[1px] border-gray-200 rounded-md px-4 py-4 flex-row items-center justify-between"
                  >
                    <Text className="text-base text-black flex-1 mr-3" style={{ fontFamily: 'Poppins-Medium' }}>
                      {item.question}
                    </Text>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                      <ChevronDown size={20} color="#666" />
                    </Animated.View>
                  </TouchableOpacity>

                  {/* Answer with animation */}
                  <Animated.View
                    style={{
                      maxHeight: animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 300],
                      }),
                      opacity: animation,
                      overflow: 'hidden',
                    }}
                  >
                    <View className="bg-white rounded-xl px-4 py-4 border border-gray-200 mt-2">
                      <Text className="text-sm text-gray-600 leading-5" style={{ fontFamily: 'Poppins-Regular' }}>
                        {item.answer}
                      </Text>
                    </View>
                  </Animated.View>
                </View>
              );
            })}
          </View>

          {/* Contact Support Section */}
          <View className="px-4 mb-6">
            <Text className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Poppins-Bold' }}>
              Contact Support
            </Text>

            <View className="bg-white rounded-2xl border border-gray-200 p-5">
              <View className="mb-4">
                <Text className="text-sm text-gray-700 mb-2" style={{ fontFamily: 'Poppins-Medium' }}>
                  Name <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter your name"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  className="bg-gray-100 border-[1px] border-gray-200 rounded-md px-4 py-3 text-black"
                  placeholderTextColor={Colors.placeholder}
                  style={{ fontFamily: 'Poppins-Regular' }}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm text-gray-700 mb-2" style={{ fontFamily: 'Poppins-Medium' }}>
                  Email <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  placeholder="Enter your email"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-gray-100 border-[1px] border-gray-200 rounded-md px-4 py-3 text-black"
                  placeholderTextColor={Colors.placeholder}
                  style={{ fontFamily: 'Poppins-Regular' }}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm text-gray-700 mb-2" style={{ fontFamily: 'Poppins-Medium' }}>
                  Message <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  placeholder="Description"
                  value={formData.message}
                  onChangeText={(text) => setFormData({ ...formData, message: text })}
                  multiline
                  numberOfLines={4}
                  className="bg-gray-100 rounded-xl px-4 py-3 text-black"
                  placeholderTextColor={Colors.placeholder}
                  style={{ fontFamily: 'Poppins-Regular', minHeight: 100, textAlignVertical: 'top' }}
                />
              </View>

              <TouchableOpacity
                onPress={handleStartLiveChat}
                activeOpacity={0.85}
                className="bg-[#4F6739] rounded-xl py-4 items-center justify-center mt-2"
              >
                <Text className="text-white text-base font-semibold" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  Start live chat
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contact Information */}
          <View className="px-4 mb-6">
            <Text className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Poppins-Bold' }}>
              Contact Information
            </Text>

            <View className="space-y-3 flex gap-3">
              <TouchableOpacity
                activeOpacity={0.85}
                className="flex-row items-center bg-white rounded-xl px-4 py-4 border border-gray-200"
              >
                <View className="w-10 h-10 rounded-full bg-[#4F6739] items-center justify-center mr-3">
                  <Mail size={20} color="white" />
                </View>
                <Text className="text-base text-black" style={{ fontFamily: 'Poppins-Medium' }}>
                  support@example.com
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                className="flex-row items-center bg-white rounded-xl px-4 py-4 border border-gray-200"
              >
                <View className="w-10 h-10 rounded-full bg-[#4F6739] items-center justify-center mr-3">
                  <Phone size={20} color="white" />
                </View>
                <Text className="text-base text-black" style={{ fontFamily: 'Poppins-Medium' }}>
                  +234 1112 2233 34
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                className="flex-row items-center bg-white rounded-xl px-4 py-4 border border-gray-200"
              >
                <View className="w-10 h-10 rounded-full bg-[#4F6739] items-center justify-center mr-3">
                  <Ionicons name="logo-whatsapp" size={20} color="white" />
                </View>
                <Text className="text-base text-black" style={{ fontFamily: 'Poppins-Medium' }}>
                  WhatsApp Support
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

