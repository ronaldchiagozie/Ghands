import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Image, StyleSheet, InteractionManager } from 'react-native';
import AnimatedModal from './AnimatedModal';
import {Colors, BorderRadius, Spacing, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { Edit2, Calendar, Clock, MapPin, Image as ImageIcon, Users, ChevronRight, X } from 'lucide-react-native';
import { Button } from './ui/Button';
import { haptics } from '@/hooks/useHaptics';
import ProfileCompletionModal from './ProfileCompletionModal';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { formatSkillLabel } from '@/utils/formatSkillLabel';

export interface BookingSummaryData {
  serviceType?: string;
  dateTime?: string;
  date?: string;
  time?: string;
  location?: string;
  photoCount?: number;
  photoUris?: string[];
  selectedProviders?: Array<{
    id: string;
    name: string;
    category: string;
    image?: any;
  }>;
}

interface BookingSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEditService?: (data: BookingSummaryData) => void;
  onEditDateTime?: (data: BookingSummaryData) => void;
  onEditLocation?: (data: BookingSummaryData) => void;
  onEditPhotos?: (data: BookingSummaryData) => void;
  onEditProviders?: (data: BookingSummaryData) => void;
  data: BookingSummaryData;
}

export default function BookingSummaryModal({
  visible,
  onClose,
  onConfirm,
  onEditService,
  onEditDateTime,
  onEditLocation,
  onEditPhotos,
  onEditProviders,
  data,
}: BookingSummaryModalProps) {
  const { isProfileComplete, checkProfileComplete, markProfileComplete } = useProfileCompletion();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleEdit = (callback?: (data: BookingSummaryData) => void) => {
    haptics.light();
    onClose();
    if (callback) {
      setTimeout(() => callback(data), 300);
    }
  };

  const handleConfirm = async () => {
    // First check cached state (faster)
    if (isProfileComplete === true) {
      // Profile is already complete, proceed with booking
      haptics.success();
      onConfirm();
      return;
    }

    // Double-check AsyncStorage to be absolutely sure (in case state is stale)
    const profileComplete = await checkProfileComplete();
    
    if (!profileComplete) {
      // Defer opening nested modal until after animations settle (reduces hang)
      InteractionManager.runAfterInteractions(() => {
        setShowProfileModal(true);
      });
      return;
    }

    // Profile is complete, proceed with booking
    haptics.success();
    onConfirm();
  };

  const handleProfileComplete = async (_profileData: {
    fullName: string;
    phoneNumber: string;
    gender: string;
  }) => {
    // Mark profile as complete immediately to prevent showing modal again
    await markProfileComplete();
    
    // Close the profile modal
    setShowProfileModal(false);
    
    // Profile completion modal is already closed by ProfileCompletionModal
    // Now proceed with booking confirmation
    haptics.success();
    
    // Small delay to ensure modal is fully closed
    setTimeout(() => {
      onConfirm();
    }, 300);
  };

  return (
    <AnimatedModal
      visible={visible}
      onClose={onClose}
      dismissible={true}
      backdropOpacity={showProfileModal ? 0 : 0.38}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Booking Summary</Text>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.closeButton}
          >
            <X size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Service Type */}
          {data.serviceType && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Service Type</Text>
                {onEditService && (
                  <TouchableOpacity
                    onPress={() => handleEdit(onEditService)}
                    activeOpacity={0.7}
                    style={styles.editButton}
                  >
                    <Edit2 size={16} color={Colors.accent} />
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionValue}>
                  {formatSkillLabel(String(data.serviceType || '')) || data.serviceType}
                </Text>
              </View>
            </View>
          )}

          {/* Date & Time */}
          {(data.dateTime || (data.date && data.time)) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Calendar size={18} color={Colors.accent} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Date & Time</Text>
                </View>
                {onEditDateTime && (
                  <TouchableOpacity
                    onPress={() => handleEdit(onEditDateTime)}
                    activeOpacity={0.7}
                    style={styles.editButton}
                  >
                    <Edit2 size={16} color={Colors.accent} />
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sectionContent}>
                <View style={styles.dateTimeRow}>
                  <Calendar size={16} color={Colors.textSecondaryDark} />
                  <Text style={styles.sectionValue}>
                    {data.dateTime || `${data.date} at ${data.time}`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Location */}
          {data.location && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <MapPin size={18} color={Colors.accent} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Location</Text>
                </View>
                {onEditLocation && (
                  <TouchableOpacity
                    onPress={() => handleEdit(onEditLocation)}
                    activeOpacity={0.7}
                    style={styles.editButton}
                  >
                    <Edit2 size={16} color={Colors.accent} />
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sectionContent}>
                <View style={styles.locationRow}>
                  <MapPin size={16} color={Colors.textSecondaryDark} />
                  <Text style={styles.sectionValue} numberOfLines={2}>
                    {data.location}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Photos */}
          {data.photoCount !== undefined && data.photoCount > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <ImageIcon size={18} color={Colors.accent} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Photos</Text>
                </View>
                {onEditPhotos && (
                  <TouchableOpacity
                    onPress={() => handleEdit(onEditPhotos)}
                    activeOpacity={0.7}
                    style={styles.editButton}
                  >
                    <Edit2 size={16} color={Colors.accent} />
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sectionContent}>
                <View style={styles.photoRow}>
                  <ImageIcon size={16} color={Colors.textSecondaryDark} />
                  <Text style={styles.sectionValue}>
                    {data.photoCount} {data.photoCount === 1 ? 'photo' : 'photos'} selected
                  </Text>
                </View>
                {data.photoUris && data.photoUris.length > 0 && (
                  <View style={styles.photoPreviewGrid}>
                    {data.photoUris.slice(0, 9).map((uri, index) => (
                      <Image
                        key={`preview-${index}`}
                        source={{ uri }}
                        style={styles.photoThumbnail}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Selected Providers */}
          {data.selectedProviders && data.selectedProviders.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Users size={18} color={Colors.accent} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>
                    Selected Providers ({data.selectedProviders.length})
                  </Text>
                </View>
                {onEditProviders && (
                  <TouchableOpacity
                    onPress={() => handleEdit(onEditProviders)}
                    activeOpacity={0.7}
                    style={styles.editButton}
                  >
                    <Edit2 size={16} color={Colors.accent} />
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.providersList}>
                {data.selectedProviders.map((provider, index) => (
                  <View key={provider.id} style={styles.providerItem}>
                    {provider.image && (
                      <Image
                        source={provider.image}
                        style={styles.providerImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.providerInfo}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      <Text style={styles.providerCategory}>
                        {formatSkillLabel(String(provider.category || '')) || provider.category}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Confirm Booking"
            onPress={handleConfirm}
            variant="primary"
            size="large"
            fullWidth
          />
        </View>
      </View>

      {/* Profile Completion Modal - Lazy mount to reduce nested modal jank */}
      {showProfileModal && isProfileComplete !== true ? (
        <ProfileCompletionModal
          visible={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onComplete={handleProfileComplete}
        />
      ) : null}
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.backgroundGray,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  editText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: Colors.accent,
    marginLeft: 4,
  },
  sectionContent: {
    marginTop: Spacing.sm,
  },
  sectionValue: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 8,
  },
  photoPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: Colors.backgroundGray,
  },
  providersList: {
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.md,
  },
  providerImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  providerCategory: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
  },
  actions: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
