import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import {Colors, BorderRadius, Spacing, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { MapPin, Navigation, X, ExternalLink } from 'lucide-react-native';
import { haptics } from '@/hooks/useHaptics';
import { formatDistance, formatTravelTime, openNavigation } from '@/utils/navigationUtils';

interface JobAcceptedModalProps {
  visible: boolean;
  onClose: () => void;
  onViewDetails: () => void;
  jobLocation: {
    address: string;
    city?: string;
    latitude: number;
    longitude: number;
  };
  distanceKm?: number;
  travelTimeMinutes?: number;
}

export default function JobAcceptedModal({
  visible,
  onClose,
  onViewDetails,
  jobLocation,
  distanceKm,
  travelTimeMinutes,
}: JobAcceptedModalProps) {
  const handleGetDirections = async () => {
    haptics.light();
    // Only open navigation if we have valid coordinates
    if (jobLocation.latitude && jobLocation.longitude && 
        jobLocation.latitude !== 0 && jobLocation.longitude !== 0) {
      await openNavigation(
        jobLocation.latitude,
        jobLocation.longitude,
        jobLocation.address
      );
    } else {
      // If no coordinates, show alert
      showAppAlert(
        'Location Not Available',
        'Navigation is not available for this location. Please contact the client for directions.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleViewDetails = () => {
    haptics.light();
    onViewDetails();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.successBadge}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.title}>Request accepted</Text>
            <Text style={styles.subtitle}>You accepted this job request</Text>
          </View>

          {/* Location Info */}
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <View style={styles.iconContainer}>
                <MapPin size={20} color={Colors.accent} />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationTitle}>
                  {jobLocation.city || 'Service Location'}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {jobLocation.address}
                </Text>
              </View>
            </View>

            {/* Distance and Time Info */}
            {(distanceKm !== undefined || travelTimeMinutes !== undefined) && distanceKm !== undefined && distanceKm > 0 && (
              <View style={styles.infoRow}>
                {distanceKm !== undefined && distanceKm > 0 && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Distance</Text>
                    <Text style={styles.infoValue}>{formatDistance(distanceKm)}</Text>
                  </View>
                )}
                {travelTimeMinutes !== undefined && travelTimeMinutes > 0 && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Travel Time</Text>
                    <Text style={styles.infoValue}>{formatTravelTime(travelTimeMinutes)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGetDirections}
              activeOpacity={0.8}
            >
              <Navigation size={18} color={Colors.white} />
              <Text style={styles.primaryButtonText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleViewDetails}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>View Full Details</Text>
              <ExternalLink size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={20} color={Colors.textSecondaryDark} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.default,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 0.76,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 32,
    color: Colors.white,
    fontFamily: 'Poppins-Bold',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    textAlign: 'center',
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.default,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: Colors.textSecondaryDark,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.default,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.default,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
