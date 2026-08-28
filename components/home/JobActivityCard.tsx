import { getCategoryIcon } from '@/utils/categoryIcons';
import { useRouter } from 'expo-router';
import { navigateToJob } from '@/utils/navigation';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';
import { Colors } from '@/lib/designSystem';
import {
  getJobDisplayStatusBadge,
  normalizeJobDisplayStatus,
  type JobDisplayStatus,
} from '@/utils/jobDisplayStatus';

export type JobActivityStatus = JobDisplayStatus;

export type JobActivity = {
  id: string;
  title: string;
  category: string;
  submittedAt: string;
  quotes: number;
  priceRange: string;
  status: JobDisplayStatus;
};

type JobActivityCardProps = {
  activity: JobActivity;
};

const JobActivityCardComponent = ({ activity }: JobActivityCardProps) => {
  const router = useRouter();
  const displayStatus = normalizeJobDisplayStatus(activity.status);
  const theme = getJobDisplayStatusBadge(displayStatus);
  const isAwaitingQuote = (activity.priceRange ?? '').toLowerCase().includes('awaiting');

  /**
   * The category's own artwork, falling back to its initials. The status pill on
   * the right already carries the status, so repeating it as an icon here said
   * nothing about which job this is.
   */
  const CategoryIcon = useMemo(
    () => getCategoryIcon(activity.category, activity.category),
    [activity.category],
  );

  const handlePress = () => {
    const requestId = parseInt(activity.id, 10);
    if (isNaN(requestId)) return;

    if (displayStatus === 'Completed') {
      router.push({
        pathname: '/CompletedJobDetail',
        params: { requestId: activity.id },
      } as any);
    } else {
      navigateToJob(router, { requestId: activity.id });
    }
  };

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl px-5 py-5"
      activeOpacity={0.7}
      onPress={handlePress}
      style={SURFACE_STYLES.homeCard}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1 pr-3">
          <View className="items-center justify-center mr-3">
            <CategoryIcon />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              className="text-base text-black"
              style={{ fontFamily: 'Poppins-SemiBold', lineHeight: 20 }}
              numberOfLines={1}
            >
              {activity.title}
            </Text>
            <Text
              className="text-xs text-gray-500"
              style={{ fontFamily: 'Poppins-Medium' }}
            >
              {activity.category}, {activity.submittedAt}
            </Text>
          </View>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: theme?.bg ?? Colors.statusPendingBg }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ fontFamily: 'Poppins-SemiBold', color: theme?.text ?? Colors.statusPendingText }}
            numberOfLines={1}
          >
            {displayStatus}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between pt-2">
        {isAwaitingQuote ? (
          <Text
            className="text-xs text-gray-500 flex-1"
            style={{ fontFamily: 'Poppins-Medium' }}
            numberOfLines={1}
          >
            No quotes yet
          </Text>
        ) : (
          <>
            <Text
              className="text-xs text-gray-600"
              style={{ fontFamily: 'Poppins-Medium' }}
              numberOfLines={1}
            >
              {activity.quotes} {activity.quotes === 1 ? 'quote' : 'quotes'}
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(79, 103, 57, 0.1)',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
                maxWidth: '58%',
              }}
            >
              <Text
                className="text-xs text-gray-900"
                style={{ fontFamily: 'Poppins-SemiBold' }}
                numberOfLines={1}
              >
                {activity.priceRange}
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const JobActivityCard = React.memo(JobActivityCardComponent);

export default JobActivityCard;
