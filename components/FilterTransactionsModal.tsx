import AnimatedModal from '@/components/AnimatedModal';
import { BorderRadius, Colors, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { ChevronDown, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface FilterTransactionsModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}

interface FilterState {
  dateRange: 'today' | 'thisWeek' | 'thisMonth' | 'custom' | null;
  status: 'completed' | 'pending' | 'failed' | null;
  serviceType: string;
  minAmount: number;
  maxAmount: number;
  sortBy: 'newest' | 'oldest' | 'highToLow' | 'lowToHigh';
}

export default function FilterTransactionsModal({ visible, onClose, onApply }: FilterTransactionsModalProps) {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: null,
    status: 'completed',
    serviceType: 'All Services',
    minAmount: 15000,
    maxAmount: 15000,
    sortBy: 'newest',
  });

  const handleReset = () => {
    setFilters({
      dateRange: null,
      status: 'completed',
      serviceType: 'All Services',
      minAmount: 15000,
      maxAmount: 15000,
      sortBy: 'newest',
    });
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
              {(['today', 'thisWeek', 'thisMonth', 'custom'] as const).map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => setFilters({ ...filters, dateRange: range })}
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
                    {range === 'thisWeek' ? 'This Week' : range === 'thisMonth' ? 'This Month' : range === 'custom' ? 'Custom Range' : 'Today'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Status
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {(['completed', 'pending', 'failed'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setFilters({ ...filters, status })}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: BorderRadius.full,
                    borderWidth: 1,
                    borderColor: filters.status === status ? Colors.accent : Colors.border,
                    backgroundColor: filters.status === status ? Colors.accent : Colors.white,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: filters.status === status ? Colors.white : Colors.textPrimary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Service Type */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Service Type
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: Colors.white,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: Colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                }}
              >
                {filters.serviceType}
              </Text>
              <ChevronDown size={20} color={Colors.textSecondaryDark} />
            </TouchableOpacity>
          </View>

          {/* Amount Range */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-Bold',
                color: Colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Amount Range
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: Colors.white,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                  }}
                >
                  ₦ {filters.minAmount.toLocaleString()}
                </Text>
              </View>
              <View
                style={{
                  flex: 2,
                  height: 40,
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                }}
              >
                <View
                  style={{
                    height: 4,
                    backgroundColor: Colors.accent,
                    borderRadius: 2,
                    position: 'relative',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -6,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: Colors.accent,
                    }}
                  />
                </View>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: Colors.white,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textPrimary,
                  }}
                >
                  ₦ {filters.maxAmount.toLocaleString()}
                </Text>
              </View>
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
