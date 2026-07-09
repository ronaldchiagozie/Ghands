import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/lib/designSystem';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { haptics } from '@/hooks/useHaptics';
import { applyDefaultStatusBar } from '@/utils/statusBar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CoachMarkStep {
  id: string;
  target: string; // Ref name for the target element
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  tooltipStyle?: any;
  spotlightPadding?: number;
}

interface CoachMarksProps {
  steps: CoachMarkStep[];
  visible: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  currentStep: number;
  onStepChange: (step: number) => void;
}

// Store refs to target elements
const targetRefs: { [key: string]: any } = {};
const targetMeasures: { [key: string]: { x: number; y: number; width: number; height: number } } = {};

export const registerTarget = (name: string, ref: any) => {
  targetRefs[name] = ref;
};

export const unregisterTarget = (name: string) => {
  delete targetRefs[name];
};

const CoachMarks: React.FC<CoachMarksProps> = ({
  steps,
  visible,
  onComplete,
  onSkip,
  currentStep,
  onStepChange,
}) => {
  const [currentMeasure, setCurrentMeasure] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipScale = useRef(new Animated.Value(0.8)).current;
  const spotlightScale = useRef(new Animated.Value(1)).current;

  const currentStepData = steps[currentStep];

  // Measure target element
  const measureTarget = useCallback(() => {
    if (!currentStepData) return;

    const targetRef = targetRefs[currentStepData.target];
    if (!targetRef) {
      // Retry after a short delay if ref not ready
      setTimeout(measureTarget, 100);
      return;
    }

    setIsMeasuring(true);

    // Use measureInWindow for accurate positioning
    targetRef.measureInWindow((x: number, y: number, width: number, height: number) => {
      const padding = currentStepData.spotlightPadding || 8;
      setCurrentMeasure({
        x: x - padding,
        y: y - padding,
        width: width + padding * 2,
        height: height + padding * 2,
      });

      // Calculate tooltip position
      const position = currentStepData.position || 'bottom';
      let tooltipTop = 0;
      let tooltipLeft = 0;
      let finalPosition: 'top' | 'bottom' | 'left' | 'right' | 'center' = position;

      const tooltipWidth = Math.min(SCREEN_WIDTH - Spacing.lg * 2, 320);
      const tooltipHeight = 200; // Approximate, will adjust based on content

      switch (position) {
        case 'top':
          tooltipTop = y - tooltipHeight - 20;
          tooltipLeft = x + width / 2 - tooltipWidth / 2;
          // If tooltip goes off screen, switch to bottom
          if (tooltipTop < Spacing.lg) {
            finalPosition = 'bottom';
            tooltipTop = y + height + 20;
          }
          break;
        case 'bottom':
          tooltipTop = y + height + 20;
          tooltipLeft = x + width / 2 - tooltipWidth / 2;
          // If tooltip goes off screen, switch to top
          if (tooltipTop + tooltipHeight > SCREEN_HEIGHT - Spacing.lg) {
            finalPosition = 'top';
            tooltipTop = y - tooltipHeight - 20;
          }
          break;
        case 'left':
          tooltipTop = y + height / 2 - tooltipHeight / 2;
          tooltipLeft = x - tooltipWidth - 20;
          // If tooltip goes off screen, switch to right
          if (tooltipLeft < Spacing.lg) {
            finalPosition = 'right';
            tooltipLeft = x + width + 20;
          }
          break;
        case 'right':
          tooltipTop = y + height / 2 - tooltipHeight / 2;
          tooltipLeft = x + width + 20;
          // If tooltip goes off screen, switch to left
          if (tooltipLeft + tooltipWidth > SCREEN_WIDTH - Spacing.lg) {
            finalPosition = 'left';
            tooltipLeft = x - tooltipWidth - 20;
          }
          break;
        case 'center':
          tooltipTop = SCREEN_HEIGHT / 2 - tooltipHeight / 2;
          tooltipLeft = SCREEN_WIDTH / 2 - tooltipWidth / 2;
          break;
      }

      // Ensure tooltip stays within screen bounds
      tooltipLeft = Math.max(Spacing.lg, Math.min(tooltipLeft, SCREEN_WIDTH - tooltipWidth - Spacing.lg));
      tooltipTop = Math.max(Spacing.lg, Math.min(tooltipTop, SCREEN_HEIGHT - tooltipHeight - Spacing.lg));

      setTooltipPosition({
        top: tooltipTop,
        left: tooltipLeft,
        position: finalPosition,
      });

      setIsMeasuring(false);

      // Animate in
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(tooltipScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(spotlightScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [currentStepData, overlayOpacity, tooltipOpacity, tooltipScale, spotlightScale]);

  useEffect(() => {
    if (visible && currentStepData) {
      // Reset animations
      overlayOpacity.setValue(0);
      tooltipOpacity.setValue(0);
      tooltipScale.setValue(0.8);
      spotlightScale.setValue(0.95);

      // Small delay to ensure layout is complete
      setTimeout(() => {
        measureTarget();
      }, 100);
    }
  }, [visible, currentStep, currentStepData, measureTarget]);

  useEffect(() => {
    if (!visible) {
      applyDefaultStatusBar();
    }
  }, [visible]);

  const handleComplete = useCallback(() => {
    haptics.success();
    
    // Animate out
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipScale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete();
    });
  }, [onComplete, overlayOpacity, tooltipOpacity, tooltipScale]);

  const handleNext = useCallback(() => {
    haptics.light();
    
    if (currentStep < steps.length - 1) {
      // Animate out
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onStepChange(currentStep + 1);
      });
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length, onStepChange, tooltipOpacity, tooltipScale, handleComplete]);

  const handleBack = useCallback(() => {
    haptics.light();
    
    if (currentStep > 0) {
      // Animate out
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onStepChange(currentStep - 1);
      });
    }
  }, [currentStep, onStepChange, tooltipOpacity, tooltipScale]);

  const handleSkip = useCallback(() => {
    haptics.light();
    onSkip?.();
  }, [onSkip]);

  if (!visible || !currentStepData || !currentMeasure || !tooltipPosition || isMeasuring) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleSkip}
    >
      <View style={styles.container}>
        {/* Semi-transparent overlay with spotlight */}
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity,
            },
          ]}
        >
          {/* Top section */}
          {currentMeasure.y > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: currentMeasure.y,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              }}
            />
          )}
          
          {/* Bottom section */}
          <View
            style={{
              position: 'absolute',
              top: currentMeasure.y + currentMeasure.height,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
          />
          
          {/* Left section */}
          {currentMeasure.x > 0 && (
            <View
              style={{
                position: 'absolute',
                top: currentMeasure.y,
                left: 0,
                width: currentMeasure.x,
                height: currentMeasure.height,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              }}
            />
          )}
          
          {/* Right section */}
          <View
            style={{
              position: 'absolute',
              top: currentMeasure.y,
              left: currentMeasure.x + currentMeasure.width,
              right: 0,
              height: currentMeasure.height,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
          />
          
          {/* Spotlight border highlight */}
          <Animated.View
            style={{
              position: 'absolute',
              left: currentMeasure.x,
              top: currentMeasure.y,
              width: currentMeasure.width,
              height: currentMeasure.height,
              borderRadius: BorderRadius.xl,
              borderWidth: 3,
              borderColor: Colors.accent,
              transform: [{ scale: spotlightScale }],
              shadowColor: Colors.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 0.76,
            }}
          />
        </Animated.View>

        {/* Tooltip */}
        <Animated.View
          style={[
            styles.tooltip,
            {
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              opacity: tooltipOpacity,
              transform: [{ scale: tooltipScale }],
            },
            currentStepData.tooltipStyle,
          ]}
        >
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentStep + 1} / {steps.length}
            </Text>
          </View>

          {/* Content */}
          <Text style={styles.tooltipTitle}>{currentStepData.title}</Text>
          <Text style={styles.tooltipDescription}>{currentStepData.description}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <ArrowLeft size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            )}
            
            <View style={styles.actionButtons}>
              {onSkip && (
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                </Text>
                {currentStep < steps.length - 1 && (
                  <ArrowRight size={18} color={Colors.white} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    minWidth: 280,
    maxWidth: SCREEN_WIDTH - Spacing.lg * 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 0.76,
  },
  progressContainer: {
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: Colors.textSecondaryDark,
  },
  tooltipTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    lineHeight: 28,
  },
  tooltipDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  actionButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.default,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondaryDark,
  },
  nextButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  nextButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
  },
});

export default CoachMarks;
