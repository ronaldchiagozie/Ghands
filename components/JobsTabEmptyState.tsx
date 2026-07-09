import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/lib/designSystem';
import { JobsEmptyIllustration, JobsEmptyVariant } from '@/components/JobsEmptyIllustrations';

export type JobsTabAudience = 'client' | 'provider';

type ClientTab = 'Pending' | 'Ongoing' | 'Completed';
type ProviderTab = 'Ongoing' | 'Pending' | 'Completed';

const CLIENT_COPY: Record<ClientTab, { variant: JobsEmptyVariant; title: string; description: string }> = {
  Pending: {
    variant: 'pending',
    title: 'No pending requests',
    description: 'New requests waiting for providers will appear here.',
  },
  Ongoing: {
    variant: 'ongoing',
    title: 'No ongoing jobs yet',
    description: 'Active bookings with a provider will appear here.',
  },
  Completed: {
    variant: 'completed',
    title: 'No completed jobs yet',
    description: 'Finished jobs will show up here.',
  },
};

const PROVIDER_COPY: Record<ProviderTab, { variant: JobsEmptyVariant; title: string; description: string }> = {
  Ongoing: {
    variant: 'ongoing',
    title: 'No ongoing jobs yet',
    description: 'Accepted jobs and active work orders will appear here.',
  },
  Pending: {
    variant: 'pending',
    title: 'No pending jobs yet',
    description: 'New requests waiting for your action will show here.',
  },
  Completed: {
    variant: 'completed',
    title: 'No completed jobs yet',
    description: 'Finished jobs will show up here.',
  },
};

type JobsTabEmptyStateProps =
  | { audience: 'client'; activeTab: ClientTab }
  | { audience: 'provider'; activeTab: ProviderTab };

export function JobsTabEmptyState(props: JobsTabEmptyStateProps) {
  const copy =
    props.audience === 'client'
      ? CLIENT_COPY[props.activeTab]
      : PROVIDER_COPY[props.activeTab];

  return (
    <View style={styles.container}>
      <JobsEmptyIllustration variant={copy.variant} size={152} />
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl * 2,
    paddingVertical: Spacing.xxxl,
  },
  title: {
    marginTop: Spacing.lg,
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    marginTop: Spacing.sm,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
});
