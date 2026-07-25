import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Colors, MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { serviceRequestService, authService } from '@/services/api';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { navigateBookingStepBack } from '@/utils/bookingFlowNavigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AM_HOURS = ['09:00', '10:00', '11:00', '12:00'];
const PM_HOURS = ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00'];

/** Minutes from midnight for scheduling slots (12:00 = noon; PM 01:00 = 13:00). */
function slotToMinutes(time: string): number {
  const [hs, ms] = time.split(':');
  const h = parseInt(hs, 10);
  const min = parseInt(ms || '0', 10);
  if (Number.isNaN(h)) return 0;
  if (AM_HOURS.includes(time)) {
    return h * 60 + min;
  }
  if (PM_HOURS.includes(time)) {
    return (h + 12) * 60 + min;
  }
  return h * 60 + min;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DateTimeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    categoryName?: string;
    selectedDate?: string;
    selectedTime?: string;
    serviceType?: string;
    photoCount?: string;
    location?: string;
    fromAiAssistant?: string;
    bookingOrigin?: string;
    conversationId?: string;
  }>();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (params.selectedDate) {
      const d = new Date(params.selectedDate as string);
      if (!isNaN(d.getTime()) && startOfDay(d) >= startOfDay(new Date())) {
        return d;
      }
    }
    return null;
  });
  const [selectedTime, setSelectedTime] = useState<string | null>(params.selectedTime || null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

    const formattedDateTime = useMemo(() => {
    if (!selectedDate || !selectedTime) return '';
    
    const month = MONTHS[selectedDate.getMonth()];
    const day = selectedDate.getDate();
    const year = selectedDate.getFullYear();
    
    // Format time (e.g., "09:00" -> "9am" or "01:00" -> "1pm")
    const [hours, minutes] = selectedTime.split(':');
    const hourNum = parseInt(hours, 10);
    
    // Determine if it's AM or PM based on the hour
    // AM_HOURS: ['09:00', '10:00', '11:00', '12:00'] -> 9am, 10am, 11am, 12pm
    // PM_HOURS: ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00'] -> 1pm-8pm
    const isAM = AM_HOURS.includes(selectedTime);
    const isPM = PM_HOURS.includes(selectedTime);
    
    let displayHour: number;
    let period: string;
    
    if (isAM) {
      // AM hours: 09:00=9am, 10:00=10am, 11:00=11am, 12:00=12pm
      if (hourNum === 12) {
        displayHour = 12;
        period = 'pm';
      } else {
        displayHour = hourNum;
        period = 'am';
      }
    } else if (isPM) {
      // PM hours: 01:00=1pm, 02:00=2pm, etc.
      displayHour = hourNum;
      period = 'pm';
    } else {
      // Fallback for any other time format
      const isAMHour = hourNum < 12;
      displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
      period = isAMHour ? 'am' : 'pm';
    }
    
    return `${month} ${day}, ${year} ${displayHour}${period}`;
  }, [selectedDate, selectedTime]);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleBack = useCallback(() => {
    haptics.light();
    navigateBookingStepBack(router, params);
  }, [router, params]);

  const handleCancel = useCallback(() => {
    navigateBookingStepBack(router, params);
  }, [router, params]);

  // Format date as YYYY-MM-DD
  const formatDateForAPI = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Format time as "HH:MM AM/PM"
  const formatTimeForAPI = useCallback((time: string): string => {
    const [hours, minutes] = time.split(':');
    const hourNum = parseInt(hours, 10);
    
    // Determine if it's AM or PM
    const isAM = AM_HOURS.includes(time);
    const isPM = PM_HOURS.includes(time);
    
    let displayHour: number;
    let period: string;
    
    if (isAM) {
      if (hourNum === 12) {
        displayHour = 12;
        period = 'PM';
      } else {
        displayHour = hourNum;
        period = 'AM';
      }
    } else if (isPM) {
      displayHour = hourNum;
      period = 'PM';
    } else {
      // Fallback
      const isAMHour = hourNum < 12;
      displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
      period = isAMHour ? 'AM' : 'PM';
    }
    
    return `${displayHour}:${minutes} ${period}`;
  }, []);

  const isSlotInPast = useCallback((date: Date, time: string) => {
    const totalM = slotToMinutes(time);
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(slotEnd.getHours() + 1);
    return slotEnd.getTime() <= Date.now();
  }, []);

  const handleNext = useCallback(async () => {
    if (!selectedDate || !selectedTime) {
      showError('Please select both date and time');
      haptics.error();
      return;
    }

    if (isSlotInPast(selectedDate, selectedTime)) {
      showError('Choose a future date and time');
      haptics.error();
      return;
    }

    if (!params.requestId) {
      showError('Request ID is missing. Please go back and try again.');
      haptics.error();
      return;
    }

    setIsUpdating(true);
    haptics.light();

    try {
      const userId = await authService.getUserId();
      
      if (!userId) {
        showError('Unable to identify your account. Please sign out and sign in again.');
        haptics.error();
        setIsUpdating(false);
        return;
      }

      const requestId = parseInt(params.requestId, 10);
      if (isNaN(requestId)) {
        showError('Invalid request ID');
        haptics.error();
        setIsUpdating(false);
        return;
      }

      // Format date and time for API
      const scheduledDate = formatDateForAPI(selectedDate);
      const scheduledTime = formatTimeForAPI(selectedTime);

      // Update date/time (Step 3)
      // userId is automatically extracted from token, don't send it
      await serviceRequestService.updateDateTime(requestId, {
        scheduledDate,
        scheduledTime,
      });

      showSuccess('Date and time updated');
      haptics.success();

      router.replace({
        pathname: '../AddPhotosScreen' as any,
        params: {
          requestId: params.requestId,
          categoryName: params.categoryName,
          selectedDateTime: formattedDateTime,
          selectedDate: selectedDate?.toISOString(),
          selectedTime: selectedTime || '',
          serviceType: params.serviceType,
          location: params.location,
          photoCount: params.photoCount,
          fromAiAssistant: params.fromAiAssistant,
          bookingOrigin: params.bookingOrigin,
          conversationId: params.conversationId,
        },
      } as any);
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      console.error('Error updating date/time:', error);
      const errorMessage = getSpecificErrorMessage(error, 'update_date_time');
      showError(errorMessage);
      haptics.error();
    } finally {
      setIsUpdating(false);
    }
  }, [
    selectedDate,
    selectedTime,
    formattedDateTime,
    params,
    router,
    showError,
    showSuccess,
    formatDateForAPI,
    formatTimeForAPI,
    isSlotInPast,
  ]);

  const canGoPreviousMonth = useMemo(() => {
    const viewFirst = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const thisMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return viewFirst.getTime() > thisMonthFirst.getTime();
  }, [currentDate]);

  const handlePreviousMonth = useCallback(() => {
    if (!canGoPreviousMonth) return;
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  }, [canGoPreviousMonth]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  }, []);

  const isCalendarDayPast = useCallback(
    (day: number, isCurrentMonth: boolean) => {
      if (!isCurrentMonth) return false;
      const cell = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      return startOfDay(cell) < startOfDay(new Date());
    },
    [currentDate]
  );

  const handleDateSelect = useCallback(
    (day: number, isCurrentMonth: boolean) => {
      if (!isCurrentMonth) return;
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      if (startOfDay(newDate) < startOfDay(new Date())) {
        haptics.error();
        showError('Past dates cannot be scheduled');
        return;
      }
      setSelectedDate(newDate);
      haptics.light();
    },
    [currentDate, showError]
  );

  const handleTimeSelect = useCallback(
    (time: string) => {
      if (!selectedDate) return;
      if (isSlotInPast(selectedDate, time)) {
        haptics.error();
        showError('That time has already passed. Pick a later slot.');
        return;
      }
      setSelectedTime(time);
      haptics.selection();
    },
    [selectedDate, isSlotInPast, showError]
  );

  useEffect(() => {
    if (!selectedDate || !selectedTime) return;
    if (isSlotInPast(selectedDate, selectedTime)) {
      setSelectedTime(null);
    }
  }, [selectedDate, selectedTime, isSlotInPast]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Get last day of previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean }> = [];

    // Add days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, isCurrentMonth: false });
    }

    // Add all days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ day, isCurrentMonth: true });
    }

    // Add days from next month to fill the last week (if needed)
    const remainingCells = 42 - days.length; // 6 rows × 7 days = 42
    for (let day = 1; day <= remainingCells; day++) {
      days.push({ day, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const monthYear = useMemo(() => {
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  const isDateSelected = useCallback(
    (day: number) => {
      if (!selectedDate) return false;
      return (
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === currentDate.getMonth() &&
        selectedDate.getFullYear() === currentDate.getFullYear()
      );
    },
    [selectedDate, currentDate]
  );

  const isToday = useCallback(
    (day: number) => {
      const today = new Date();
      return (
        day === today.getDate() &&
        currentDate.getMonth() === today.getMonth() &&
        currentDate.getFullYear() === today.getFullYear()
      );
    },
    [currentDate]
  );

  const canProceed = selectedDate !== null && selectedTime !== null;



  const animatedStyles = useMemo(
    () => ({
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    }),
    [fadeAnim, slideAnim]
  );

  return (
    <SafeAreaWrapper>
      <Animated.View style={[animatedStyles, { flex: 1 }]}>
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={handleBack}
              className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
            >
              <ArrowLeft size={20} color="#111827" />
            </TouchableOpacity>
            <Text className="text-xl text-black" style={{ fontFamily: 'Poppins-Bold' }}>
              Date & Time
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View className="mb-6">
            <Text className="text-base text-black mb-3" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Select Date
            </Text>
            <View className="rounded-2xl bg-white border border-gray-200 p-4 shadow-[0_6px_18px_rgba(16,24,40,0.05)]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  {monthYear}
                </Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={handlePreviousMonth}
                    disabled={!canGoPreviousMonth}
                    style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: Colors.backgroundGray, opacity: canGoPreviousMonth ? 1 : 0.35 }}
                    activeOpacity={canGoPreviousMonth ? 0.7 : 1}
                    accessibilityLabel="Previous month"
                  >
                    <ChevronLeft size={16} color={canGoPreviousMonth ? '#111827' : '#9CA3AF'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: Colors.backgroundGray }}
                    activeOpacity={0.7}
                    accessibilityLabel="Next month"
                  >
                    <ChevronRight size={16} color="#111827" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row mb-2">
                {DAYS.map((day) => (
                  <View key={day} className="flex-1 items-center py-2">
                    <Text className="text-xs text-gray-500" style={{ fontFamily: 'Poppins-Medium' }}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="flex-row flex-wrap">
                {calendarDays.map((item, index) => {
                  const { day, isCurrentMonth } = item;
                  const isPastDay = isCalendarDayPast(day, isCurrentMonth);
                  const selectable = isCurrentMonth && !isPastDay;
                  const selected = isCurrentMonth && isDateSelected(day);
                  const today = isCurrentMonth && isToday(day);

                  return (
                    <TouchableOpacity
                      key={`day-${day}-${index}`}
                      onPress={() => handleDateSelect(day, isCurrentMonth)}
                      activeOpacity={selectable ? 0.7 : 1}
                      disabled={!selectable}
                      className="w-[14.28%] aspect-square p-1"
                      style={{ opacity: !isCurrentMonth ? 0.35 : isPastDay ? 0.4 : 1 }}
                    >
                      <View
                        className={`flex-1 items-center justify-center rounded-full ${
                          selected
                            ? 'bg-[#4F6739]'
                            : today && !isPastDay
                              ? 'bg-gray-100 border border-gray-300'
                              : 'bg-transparent'
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            selected
                              ? 'text-white'
                              : isCurrentMonth
                                ? isPastDay
                                  ? 'text-gray-400'
                                  : today
                                    ? 'text-black'
                                    : 'text-gray-700'
                                : 'text-gray-300'
                          }`}
                          style={{
                            fontFamily: selected ? 'Poppins-SemiBold' : 'Poppins-Medium',
                          }}
                        >
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-base text-black mb-3" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Select Hours
            </Text>

            <View className="mb-4">
              <Text className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Poppins-Medium' }}>
                AM
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {AM_HOURS.map((hour) => {
                  const isSelected = selectedTime === hour;
                  const slotPast =
                    !!selectedDate && isSlotInPast(selectedDate, hour);
                  const disabled = !selectedDate || slotPast;
                  return (
                    <TouchableOpacity
                      key={`am-${hour}`}
                      onPress={() => handleTimeSelect(hour)}
                      disabled={disabled}
                      activeOpacity={disabled ? 1 : 0.7}
                      className={`rounded-xl px-4 py-3 border ${
                        isSelected
                          ? 'bg-[#4F6739] border-[#4F6739]'
                          : disabled
                            ? 'bg-gray-50 border-gray-100'
                            : 'bg-white border-gray-200'
                      }`}
                      style={{ opacity: disabled && !isSelected ? 0.45 : 1 }}
                    >
                      <Text
                        className={`text-sm ${
                          isSelected ? 'text-white' : disabled ? 'text-gray-400' : 'text-[#4F6739]'
                        }`}
                        style={{ fontFamily: 'Poppins-SemiBold' }}
                      >
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Poppins-Medium' }}>
                PM
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {PM_HOURS.map((hour) => {
                  const isSelected = selectedTime === hour;
                  const slotPast =
                    !!selectedDate && isSlotInPast(selectedDate, hour);
                  const disabled = !selectedDate || slotPast;
                  return (
                    <TouchableOpacity
                      key={`pm-${hour}`}
                      onPress={() => handleTimeSelect(hour)}
                      disabled={disabled}
                      activeOpacity={disabled ? 1 : 0.7}
                      className={`rounded-xl px-4 py-3 border ${
                        isSelected
                          ? 'bg-[#4F6739] border-[#4F6739]'
                          : disabled
                            ? 'bg-gray-50 border-gray-100'
                            : 'bg-white border-gray-200'
                      }`}
                      style={{ opacity: disabled && !isSelected ? 0.45 : 1 }}
                    >
                      <Text
                        className={`text-sm ${
                          isSelected ? 'text-white' : disabled ? 'text-gray-400' : 'text-[#4F6739]'
                        }`}
                        style={{ fontFamily: 'Poppins-SemiBold' }}
                      >
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        <View className="px-4 pb-5 gap-3">
          <Button
            title={isUpdating ? 'Updating…' : 'Next'}
            onPress={handleNext}
            variant="secondary"
            size="large"
            fullWidth
            disabled={!canProceed || isUpdating}
            loading={isUpdating}
            icon={
              <ArrowRight
                size={18}
                color={!canProceed || isUpdating ? Colors.textTertiary : Colors.white}
              />
            }
            iconPosition="right"
          />

          <Button
            title="Cancel request"
            onPress={handleCancel}
            variant="outline"
            size="large"
            fullWidth
          />
        </View>
      </Animated.View>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}

