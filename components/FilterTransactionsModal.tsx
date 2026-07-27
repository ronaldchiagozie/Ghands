import AnimatedModal from '@/components/AnimatedModal';
import { BorderRadius, Colors, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * Only filters with real data behind them live here. Status is owned by the
 * Activity tabs, so a second Status control would just contradict them.
 * Service Type, Amount Range and a custom date range were removed rather than
 * shipped as controls that silently do nothing — they need category data, a
 * real min/max from the transaction set, and a date picker respectively.
 */
export interface FilterState {
  dateRange: 'today' | 'thisWeek' | 'thisMonth' | null;
  sortBy: 'newest' | 'oldest' | 'highToLow' | 'lowToHigh';
}

export const DEFAULT_TRANSACTION_FILTERS: FilterState = {
  dateRange: null,
  sortBy: 'newest',
};

interface FilterTransactionsModalProps {
  visible: boolean;
  /** What the list is filtered by right now, so reopening never drifts from it. */
  appliedFilters: FilterState;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}

export default function FilterTransactionsModal({
  visible,
  appliedFilters,
  onClose,
  onApply,
}: FilterTransactionsModalProps) {
  const [filters, setFilters] = useState<FilterState>(appliedFilters);

  // Re-seed from what is actually applied — closing with X must not leave the
  // controls showing a selection the list never received.
  useEffect(() => {
    if (visible) setFilters(appliedFilters);
  }, [visible, appliedFilters]);

  const handleReset = () => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  return (
    <AnimatedModal visible={visible} onClose={onClose} animationType="slide">
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
            }}
          >
            Filter Transactions
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
            accessibilityLabel="Close filter"
            accessibilityHint="Dismisses the filter panel"
          >
            <X size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 20,
          }}
        >
          {/* Date Range */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Date Range
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {(['today', 'thisWeek', 'thisMonth'] as const).map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() =>
                    // Tapping the active chip clears it — otherwise a date range
                    // can be selected but never removed.
                    setFilters({ ...filters, dateRange: filters.dateRange === range ? null : range })
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: filters.dateRange === range }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: BorderRadius.full,
                    borderWidth: 1,
                    borderColor: filters.dateRange === range ? Colors.accent : Colors.border,
                    backgroundColor: filters.dateRange === range ? Colors.accent : Colors.white,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: filters.dateRange === range ? Colors.white : Colors.textPrimary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {range === 'thisWeek' ? 'This Week' : range === 'thisMonth' ? 'This Month' : 'Today'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort By */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Sort By
            </Text>
            {(['newest', 'oldest', 'highToLow', 'lowToHigh'] as const).map((sort) => (
              <TouchableOpacity
                key={sort}
                onPress={() => setFilters({ ...filters, sortBy: sort })}
                accessibilityRole="radio"
                accessibilityState={{ selected: filters.sortBy === sort }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: Colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  {filters.sortBy === sort && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: Colors.accent,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                  }}
                >
                  {sort === 'newest' ? 'Newest to Oldest' : sort === 'oldest' ? 'Oldest to Newest' : sort === 'highToLow' ? 'Amount: High to Low' : 'Amount: Low to High'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          <TouchableOpacity
            onPress={handleReset}
            style={{
              flex: 1,
              backgroundColor: Colors.white,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: Colors.border,
            }}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              Reset
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleApply}
            style={{
              flex: 1,
              backgroundColor: Colors.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.white,
              }}
            >
              Apply Filters
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedModal>
  );
}
