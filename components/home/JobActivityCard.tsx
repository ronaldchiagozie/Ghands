import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';
import { Colors } from '@/lib/designSystem';
import { JOB_STATUS_BADGE } from '@/lib/statusBadges';

export type JobActivityStatus = 'Completed' | 'In Progress' | 'Pending' | 'Rejected';

export type JobActivity = {
  id: string;
  title: string;
  category: string;
  submittedAt: string;
  quotes: number;
  priceRange: string;
  status: JobActivityStatus;
};

const jobStatusTheme: Record<JobActivityStatus, { badgeBg: string; badgeText: string }> = {
  Completed: {
    badgeBg: JOB_STATUS_BADGE.completed.bg,
    badgeText: JOB_STATUS_BADGE.completed.text,
  },
  'In Progress': {
    badgeBg: JOB_STATUS_BADGE.inProgress.bg,
    badgeText: JOB_STATUS_BADGE.inProgress.text,
  },
  Pending: {
    badgeBg: JOB_STATUS_BADGE.pending.bg,
    badgeText: JOB_STATUS_BADGE.pending.text,
  },
  Rejected: {
    badgeBg: JOB_STATUS_BADGE.rejected.bg,
    badgeText: JOB_STATUS_BADGE.rejected.text,
  },
};

type JobActivityCardProps = {
  activity: JobActivity;
};

const JobActivityCardComponent = ({ activity }: JobActivityCardProps) => {
  const router = useRouter();
  const theme = jobStatusTheme[activity.status];
  const isAwaitingQuote = activity.priceRange.toLowerCase().includes('awaiting');

  const handlePress = () => {
    const requestId = parseInt(activity.id, 10);
    if (isNaN(requestId)) return;

    // All non-completed jobs (In Progress, Pending) go to OngoingJobDetails (Check Updates page)
    if (activity.status === 'Completed') {
      router.push({
        pathname: '/CompletedJobDetail',
        params: { requestId: activity.id },
      } as any);
    } else {
      // Navigate to OngoingJobDetails for In Progress and Pending jobs
      router.push({
        pathname: '/OngoingJobDetails',
        params: { requestId: activity.id },
      } as any);
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
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: Colors.successLight }}
          >
            <Ionicons name="construct" size={17} color={Colors.accent} />
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
              {activity.category} • {activity.submittedAt}
            </Text>
          </View>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: theme.badgeBg }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ fontFamily: 'Poppins-SemiBold', color: theme.badgeText }}
          >
            {activity.status}
          </Text>
        </View>
      </View>
      {/* One short footer line — avoid repeating quote count + “pending” + long helper copy */}
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

