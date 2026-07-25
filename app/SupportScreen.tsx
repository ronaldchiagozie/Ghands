import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import Toast from '@/components/Toast';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { isValidEmail } from '@/utils/inputFormatting';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronDown, Mail, Phone, Search } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'How do I book a service?',
    answer:
      'Tap the + button or Categories, choose a service, add job details and location, pick a time, then invite providers. Accept a quote and pay from your wallet when you are ready.',
  },
  {
    id: '2',
    question: 'How do I pay for a job?',
    answer:
      'Top up your GHands wallet under Profile → Wallet. When you accept a quote, payment is taken from your wallet balance.',
  },
  {
    id: '3',
    question: 'How do I message my provider?',
    answer:
      'Open Jobs, select your ongoing job, and use Chat to message the provider assigned to that request.',
  },
  {
    id: '4',
    question: 'Can I cancel a request?',
    answer:
      'If the job is still pending, open it from the Jobs tab and use Cancel when available. After a provider has started work, contact support for help.',
  },
  {
    id: '5',
    question: 'Where do I track job progress?',
    answer:
      'All active and completed jobs live under the Jobs tab. Tap a job to see status, quotes, chat, and payment details.',
  },
];

const MIN_MESSAGE_LENGTH = 10;

export default function SupportScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredFAQs = useMemo(
    () =>
      FAQ_ITEMS.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery],
  );

  const toggleFAQ = (id: string) => {
    haptics.light();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSendMessage = async () => {
    const name = formData.name.trim();
    const email = formData.email.trim();
    const message = formData.message.trim();

    if (!name) {
      showError('Please enter your name.');
      return;
    }
    if (!email) {
      showError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (!message) {
      showError('Please describe how we can help.');
      return;
    }
    if (message.length < MIN_MESSAGE_LENGTH) {
      showError(`Your message should be at least ${MIN_MESSAGE_LENGTH} characters.`);
      return;
    }

    haptics.light();
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setFormData({ name: '', email: '', message: '' });
      showSuccess('Message sent. We will reply to your email within 1–2 business days.');
    } catch {
      showError('Could not send your message. Try again or start live chat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="Help centre" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <Search size={18} color={Colors.textSecondaryDark} style={styles.searchIcon} />
          <TextInput
            placeholder="Search help topics"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.placeholder}
            style={styles.searchInput}
          />
        </View>

        <TouchableOpacity
          onPress={() => router.push('/UserGuideScreen' as never)}
          activeOpacity={0.7}
          style={[styles.guideBanner, providerListCard]}
        >
          <View style={styles.guideIcon}>
            <BookOpen size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideTitle}>User guide</Text>
            <Text style={styles.guideSubtitle}>Walk through booking step by step</Text>
          </View>
          <ChevronDown size={18} color={Colors.textSecondaryDark} style={{ transform: [{ rotate: '-90deg' }] }} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Common questions</Text>

        <View style={[styles.faqCard, providerListCard]}>
          {filteredFAQs.length === 0 ? (
            <Text style={styles.emptyFaq}>No results. Try another search or start live chat.</Text>
          ) : (
            filteredFAQs.map((item, index) => {
              const open = expandedId === item.id;
              return (
                <View key={item.id}>
                  <TouchableOpacity
                    onPress={() => toggleFAQ(item.id)}
                    activeOpacity={0.7}
                    style={[styles.faqRow, index < filteredFAQs.length - 1 && !open && styles.faqRowBorder]}
                  >
                    <Text style={styles.faqQuestion}>{item.question}</Text>
                    <ChevronDown
                      size={20}
                      color={Colors.textSecondaryDark}
                      style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>
                  {open ? (
                    <View style={styles.faqAnswerWrap}>
                      <Text style={styles.faqAnswer}>{item.answer}</Text>
                    </View>
                  ) : null}
                  {index < filteredFAQs.length - 1 && open ? (
                    <View style={styles.faqDivider} />
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>Contact support</Text>
        <Text style={styles.sectionLead}>
          Send us a message and we will get back to you by email.
        </Text>

        <View style={[styles.formCard, providerListCard]}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              placeholder="Your full name"
              value={formData.name}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
              placeholderTextColor={Colors.placeholder}
              style={styles.fieldInput}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              placeholder="you@email.com"
              value={formData.email}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={Colors.placeholder}
              style={styles.fieldInput}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Message <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              placeholder="Tell us about your booking, payment, or account issue"
              value={formData.message}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, message: text }))}
              multiline
              placeholderTextColor={Colors.placeholder}
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              editable={!isSubmitting}
            />
          </View>

          <TouchableOpacity
            onPress={handleSendMessage}
            activeOpacity={0.85}
            disabled={isSubmitting}
            style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
          >
            <Text style={styles.primaryBtnText}>{isSubmitting ? 'Sending…' : 'Send message'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.push('/LiveChatScreen' as never);
            }}
            activeOpacity={0.8}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Start live chat instead</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Other ways to reach us</Text>

        <View style={[styles.contactCard, providerListCard]}>
          <View style={styles.contactRow}>
            <View style={styles.contactIcon}>
              <Mail size={18} color={Colors.white} />
            </View>
            <Text style={styles.contactText}>support@ghands.com</Text>
          </View>
          <View style={styles.contactDivider} />
          <View style={styles.contactRow}>
            <View style={styles.contactIcon}>
              <Phone size={18} color={Colors.white} />
            </View>
            <Text style={styles.contactText}>+234 800 GHANDS</Text>
          </View>
          <View style={styles.contactDivider} />
          <View style={styles.contactRow}>
            <View style={styles.contactIcon}>
              <Ionicons name="logo-whatsapp" size={18} color={Colors.white} />
            </View>
            <Text style={styles.contactText}>WhatsApp support</Text>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
    paddingTop: 16,
    paddingBottom: 40,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    minHeight: MIN_TOUCH_TARGET,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
  },
  guideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.sageTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  guideTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  guideSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  faqCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 28,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  faqRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(17, 24, 39, 0.06)',
  },
  faqDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
    marginHorizontal: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  faqAnswerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqAnswer: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    lineHeight: 21,
  },
  emptyFaq: {
    padding: 16,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
  },
  sectionLead: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    lineHeight: 21,
    marginTop: -4,
    marginBottom: 14,
  },
  formCard: {
    padding: 16,
    marginBottom: 28,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.default,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
  },
  fieldInputMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  primaryBtn: {
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  secondaryBtn: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.accent,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
  },
  contactCard: {
    padding: 0,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  contactDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
    marginLeft: 68,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactText: {
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
  },
});
