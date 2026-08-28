import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, Spacing, MIN_TOUCH_TARGET, useKeyboardAvoidingOffset, useScrollViewKeyboardAssist } from '@/lib/designSystem';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AlertCircle, FileText, Upload, X } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';
import { haptics } from '@/hooks/useHaptics';

interface UploadedFile {
  uri: string;
  name: string;
  size?: number;
}

const ISSUE_OPTIONS = [
  { id: '1', label: 'Review Job completion status' },
  { id: '2', label: 'Payment not released' },
  { id: '3', label: 'Inappropriate client behavior' },
  { id: '4', label: 'Others (Please specify)' },
];

export default function ReportIssueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    jobTitle?: string;
    orderNumber?: string;
    cost?: string;
    assignee?: string;
    completionDate?: string;
  }>();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const keyboardOffset = useKeyboardAvoidingOffset();
  const descriptionSectionY = useRef(0);
  const { scrollRef, scrollBottomPad, scrollFieldIntoView } = useScrollViewKeyboardAssist();

  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'evidence.jpg';
        const fileSize = asset.fileSize;

        const file: UploadedFile = {
          uri: asset.uri,
          name: fileName,
          size: fileSize,
        };

        setUploadedFiles([...uploadedFiles, file]);
        haptics.success();
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      showError('Failed to upload file. Please try again.');
    }
  };

  const handleRemoveFile = (index: number) => {
    haptics.light();
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}b`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
  };

  const handleSubmit = async () => {
    if (!selectedIssue) {
      showError('Please select an issue type.');
      return;
    }

    if (selectedIssue === '4' && !description.trim()) {
      showError('Please specify the issue in the description field.');
      return;
    }

    if (!description.trim() && selectedIssue !== '4') {
      showError('Please describe the issue in detail.');
      return;
    }

    try {
      setIsSubmitting(true);
      haptics.light();

      if (!__DEV__) {
        showError('Issue reporting is coming soon. Please use Help & Support for urgent issues.');
        return;
      }

      // TODO: Implement API call to submit report
      // await reportService.submitIssue({
      //   requestId: params.requestId,
      //   issueType: selectedIssue,
      //   description,
      //   files: uploadedFiles,
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      haptics.success();
      showSuccess('Issue reported. We will review it within 24–48 hours.');

      // Navigate back after a short delay
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting report:', error);
      haptics.error();
      showError('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScreenHeader title="Report Issue" onBack={() => navigateBack(router, NAV_FALLBACK.clientJobs)} backgroundColor={Colors.white} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: scrollBottomPad,
          }}
        >
          {/* Introduction */}
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 20,
              lineHeight: 20,
            }}
          >
            Tell us what went wrong with this completed job. Our support team will review and assist.
          </Text>

          {/* Job Details Card */}
          <View
            style={{
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.lg,
              padding: 14,
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              {params.jobTitle || 'Kitchen sink replacement'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                Order Number
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                {params.orderNumber || 'Order #WO-2024-1157'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                Cost
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                }}
              >
                {params.cost || '₦48,500.00'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: BorderRadius.full,
                  backgroundColor: Colors.accent,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                {params.assignee || 'JohnDoe Akpan'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 16,
                  height: 16,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                Completed {params.completionDate || 'Oct 20, 2025'}
              </Text>
            </View>
          </View>

          {/* Tell us the problem */}
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Tell us the problem
          </Text>
          <View style={{ marginBottom: 20 }}>
            {ISSUE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  haptics.selection();
                  setSelectedIssue(option.id);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  marginBottom: 8,
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.default,
                  borderWidth: 1,
                  borderColor:
                    selectedIssue === option.id ? Colors.accent : Colors.border,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: BorderRadius.full,
                    borderWidth: 2,
                    borderColor:
                      selectedIssue === option.id ? Colors.accent : Colors.border,
                    marginRight: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedIssue === option.id && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: BorderRadius.full,
                        backgroundColor: Colors.accent,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                    flex: 1,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Describe the issue */}
          <View
            onLayout={(event) => {
              descriptionSectionY.current = event.nativeEvent.layout.y;
            }}
          >
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Describe the issue in detail
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            onFocus={() => scrollFieldIntoView(descriptionSectionY.current, true)}
            placeholder="Please provide details about the issue..."
            placeholderTextColor={Colors.placeholder}
            multiline
            numberOfLines={6}
            style={{
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.default,
              padding: 14,
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textPrimary,
              borderWidth: 1,
              borderColor: Colors.border,
              minHeight: 120,
              textAlignVertical: 'top',
              marginBottom: 20,
            }}
          />
          </View>

          {/* Upload evidence */}
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Upload evidence
          </Text>
          <TouchableOpacity
            onPress={handleUpload}
            style={{
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.default,
              borderWidth: 2,
              borderColor: Colors.border,
              borderStyle: 'dashed',
              padding: 24,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
            activeOpacity={0.7}
          >
            <Upload size={32} color={Colors.textTertiary} style={{ marginBottom: 8 }} />
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              Tap to upload
            </Text>
          </TouchableOpacity>

          {/* Uploaded files */}
          {uploadedFiles.map((file, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.default,
                padding: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: BorderRadius.full,
                  backgroundColor: Colors.backgroundGray,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <FileText size={16} color={Colors.textSecondaryDark} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textPrimary,
                    marginBottom: 4,
                  }}
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                {file.size && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    {formatFileSize(file.size)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveFile(index)}
                style={{
                  width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <X size={18} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Information Banner */}
          <View
            style={{
              backgroundColor: Colors.infoLight,
              borderRadius: BorderRadius.default,
              padding: 14,
              marginTop: 20,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={18} color={Colors.info} style={{ marginRight: 10, marginTop: 2 }} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: Colors.info,
                flex: 1,
                lineHeight: 18,
              }}
            >
              Reporting an issue does not affect your rating or future job eligibility. Our team
              typically responds within 24-48 hours.
            </Text>
          </View>
        </ScrollView>

        {/* Submit button — a flex sibling, not absolute, so the keyboard lifts it */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            backgroundColor: Colors.white,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: Colors.accent,
              borderRadius: BorderRadius.default,
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSubmitting ? 0.6 : 1,
            }}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.white,
                }}
              >
                Submit Report
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
