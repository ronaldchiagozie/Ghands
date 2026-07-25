import { EmptyState } from '@/components/EmptyState';
import FilterTransactionsModal from '@/components/FilterTransactionsModal';
import { TransactionCardSkeleton } from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, REFRESH_CONTROL } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import {
  providerHomeActionButton,
  providerHomeActionLabel,
  providerHomeSurface,
  providerHomeSurfacePadding,
} from '@/lib/providerSurfaceStyles';
import { walletService } from '@/services/api';
import { openClientReceipt } from '@/utils/receiptNavigation';
import { isCancelledWalletTransaction, mapWalletTransactionStatus } from '@/utils/walletTransactions';
import { useRouter, useFocusEffect } from 'expo-router';
import { CheckCircle, Clock, Filter, Receipt, XCircle } from 'lucide-react-native';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FlatList, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Transaction {
  id: string;
  serviceName: string;
  serviceDescription: string;
  date: string;
  time: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  requestId?: string;
  reference?: string;
}

type TransactionRowProps = {
  transaction: Transaction;
  onViewDetails: (transaction: Transaction) => void;
  onViewReceipt: (transaction: Transaction) => void;
};

const TransactionRow = React.memo(function TransactionRow({
  transaction,
  onViewDetails,
  onViewReceipt,
}: TransactionRowProps) {
  return (
    <View
      style={{
        ...providerHomeSurface,
        padding: providerHomeSurfacePadding,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: BorderRadius.default,
            backgroundColor: Colors.backgroundGray,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {transaction.status === 'completed' ? (
            <CheckCircle size={20} color={Colors.accent} />
          ) : transaction.status === 'pending' ? (
            <Clock size={20} color={Colors.warning} />
          ) : (
            <XCircle size={20} color={Colors.errorBright} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 2,
              lineHeight: 18,
            }}
            numberOfLines={1}
          >
            {transaction.serviceName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 2,
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            {transaction.serviceDescription}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
            }}
          >
            {transaction.date} · {transaction.time}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor:
                transaction.status === 'completed'
                  ? Colors.successLight
                  : transaction.status === 'pending'
                  ? Colors.warningBadge
                  : Colors.errorBadge,
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                color:
                  transaction.status === 'completed'
                    ? Colors.successForeground
                    : transaction.status === 'pending'
                    ? Colors.warningForeground
                    : Colors.errorForeground,
                textTransform: 'capitalize',
              }}
            >
              {transaction.status}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 15,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              letterSpacing: -0.3,
            }}
          >
            ₦{transaction.amount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>
      {transaction.status === 'completed' ? (
        <TouchableOpacity
          onPress={() => onViewReceipt(transaction)}
          style={{ ...providerHomeActionButton, width: '100%' }}
          activeOpacity={0.85}
        >
          <Receipt size={15} color={Colors.textPrimary} style={{ marginRight: 5 }} />
          <Text style={providerHomeActionLabel}>View Receipt</Text>
        </TouchableOpacity>
      ) : transaction.status === 'pending' ? (
        <TouchableOpacity
          onPress={() => onViewDetails(transaction)}
          style={{ ...providerHomeActionButton, width: '100%' }}
          activeOpacity={0.85}
        >
          <Text style={providerHomeActionLabel}>View details</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default function ActivityScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'completed' | 'pending' | 'failed'>('completed');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Helper function to format date
  const formatDate = useCallback((dateString: string): { date: string; time: string } => {
    try {
      const date = new Date(dateString);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return { date: dateStr, time: timeStr };
    } catch {
      return { date: 'N/A', time: 'N/A' };
    }
  }, []);

  // Helper function to map API transaction to UI transaction
  const mapTransactionToUI = useCallback((apiTransaction: any): Transaction | null => {
    try {
      if (isCancelledWalletTransaction(apiTransaction)) {
        return null;
      }

      // Extract service name from description or use default
      let serviceName = 'Service Payment';
      let serviceDescription = apiTransaction.description || 'Wallet transaction';
      
      // Try to extract service name from description
      if (apiTransaction.description) {
        const desc = apiTransaction.description.toLowerCase();
        if (desc.includes('service request')) {
          serviceName = `Service Request #${apiTransaction.requestId || 'N/A'}`;
          serviceDescription = apiTransaction.description;
        } else if (desc.includes('deposit')) {
          serviceName = 'Wallet Deposit';
          serviceDescription = 'Funds added to wallet';
        } else if (desc.includes('withdrawal')) {
          serviceName = 'Withdrawal';
          serviceDescription = 'Funds withdrawn to bank';
        } else if (desc.includes('earnings')) {
          serviceName = 'Earnings';
          serviceDescription = 'Payment received for completed service';
        } else if (desc.includes('refund')) {
          serviceName = 'Refund';
          serviceDescription = apiTransaction.description;
        }
      }

      const { date, time } = formatDate(apiTransaction.createdAt || apiTransaction.completedAt || new Date().toISOString());
      const status = mapWalletTransactionStatus(apiTransaction);
      
      return {
        id: String(apiTransaction.id || apiTransaction.reference || Math.random()),
        serviceName,
        serviceDescription,
        date,
        time,
        amount: Math.abs(apiTransaction.amount || 0), // Use absolute value for display
        status,
        requestId: apiTransaction.requestId != null ? String(apiTransaction.requestId) : undefined,
        reference: apiTransaction.reference ? String(apiTransaction.reference) : undefined,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('Error mapping transaction:', error);
      }
      return null;
    }
  }, [formatDate]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await walletService.getTransactions({ limit: 100, offset: 0 });
      const mappedTransactions = result.transactions
        .map(mapTransactionToUI)
        .filter((t): t is Transaction => t !== null);
      setTransactions(mappedTransactions);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading transactions:', error);
      }
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapTransactionToUI]);

  // Load transactions on mount
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  }, [loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  // Calculate stats from real transactions
  const totalSpent = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalTransactions = transactions.length;
  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const failedCount = transactions.filter(t => t.status === 'failed').length;

  // Filter transactions by selected tab and search query
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesTab = transaction.status === selectedTab;
    const matchesSearch = searchQuery.trim() === '' || 
      transaction.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.serviceDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleViewDetails = (transaction: Transaction) => {
    if (transaction.status === 'pending') {
      router.push({
        pathname: '/PaymentPendingScreen',
        params: {
          transactionId: transaction.id,
          amount: transaction.amount.toString(),
          providerName: transaction.serviceName,
        },
      } as any);
    } else if (transaction.status === 'failed') {
      router.push({
        pathname: '/TransactionFailedScreen',
        params: {
          transactionId: transaction.id,
          amount: transaction.amount.toString(),
          providerName: transaction.serviceName,
          serviceFee: (transaction.amount * 0.93).toFixed(2), // Approximate service fee
          platformFee: (transaction.amount * 0.07).toFixed(2), // Approximate platform fee
          totalAmount: transaction.amount.toFixed(2),
        },
      } as any);
    }
  };

  const handleViewReceipt = (transaction: Transaction) => {
    openClientReceipt(router, {
      transactionId: transaction.id,
      requestId: transaction.requestId,
      reference: transaction.reference,
      providerName: transaction.serviceName,
      serviceName: transaction.serviceDescription,
      amount: transaction.amount.toString(),
    });
  };

  const listHeader = useMemo(
    () => (
      <>
        <View
          style={{
            ...providerHomeSurface,
            padding: providerHomeSurfacePadding,
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Medium',
              color: Colors.textSecondaryDark,
              marginBottom: 8,
            }}
          >
            Total spent this month
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 4,
              letterSpacing: -0.4,
            }}
          >
            ₦{totalSpent.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 16,
            }}
          >
            Across {totalTransactions} transactions
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.accent,
                  marginBottom: 4,
                }}
              >
                {completedCount}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                }}
              >
                Completed
              </Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.warning,
                  marginBottom: 4,
                }}
              >
                {pendingCount}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                }}
              >
                Pending
              </Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.errorBright,
                  marginBottom: 4,
                }}
              >
                {failedCount}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                }}
              >
                Failed
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
            gap: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.backgroundGray,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <TextInput
              placeholder="Search transactions"
              placeholderTextColor={Colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Search transactions"
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Regular',
                color: Colors.textPrimary,
              }}
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowFilterModal(true)}
            style={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              ...providerHomeSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.85}
            accessibilityLabel="Filter transactions"
            accessibilityHint="Opens filter options"
          >
            <Filter size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          }}
        >
          {(['completed', 'pending', 'failed'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setSelectedTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab === tab }}
              accessibilityLabel={`${tab} transactions`}
              style={{
                flex: 1,
                paddingBottom: 12,
                alignItems: 'center',
                borderBottomWidth: selectedTab === tab ? 3 : 0,
                borderBottomColor: selectedTab === tab ? Colors.accent : 'transparent',
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: selectedTab === tab ? 'Poppins-SemiBold' : 'Poppins-Regular',
                  color: selectedTab === tab ? Colors.textPrimary : Colors.textSecondaryDark,
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    ),
    [
      completedCount,
      failedCount,
      pendingCount,
      searchQuery,
      selectedTab,
      totalSpent,
      totalTransactions,
    ]
  );

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow
        transaction={item}
        onViewDetails={handleViewDetails}
        onViewReceipt={handleViewReceipt}
      />
    ),
    [handleViewDetails, handleViewReceipt]
  );

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <>
          <TransactionCardSkeleton />
          <TransactionCardSkeleton />
          <TransactionCardSkeleton />
        </>
      );
    }
    return (
      <EmptyState
        icon={<Receipt size={40} color={Colors.textSecondaryDark} />}
        title={`No ${selectedTab} transactions`}
        description={
          searchQuery
            ? 'No transactions match your search'
            : `You don't have any ${selectedTab} transactions yet`
        }
        style={{
          flex: 0,
          ...providerHomeSurface,
          padding: providerHomeSurfacePadding + 18,
        }}
      />
    );
  }, [isLoading, searchQuery, selectedTab]);

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <ScreenHeader title="Activity" onBack={() => router.back()} backgroundColor={Colors.backgroundLight} />
      <FlatList
        data={isLoading ? [] : filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={REFRESH_CONTROL.tintColor}
            colors={REFRESH_CONTROL.colors as unknown as string[]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />


      {/* Filter Modal */}
      <FilterTransactionsModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={(filters) => {
          // Handle filter application
          if (__DEV__) console.log('Filters applied');
        }}
      />
    </SafeAreaWrapper>
  );
}
