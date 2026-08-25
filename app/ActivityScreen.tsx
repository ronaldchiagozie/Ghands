import { EmptyState } from '@/components/EmptyState';
import FilterTransactionsModal, {
  DEFAULT_TRANSACTION_FILTERS,
  type FilterState,
} from '@/components/FilterTransactionsModal';
import { TransactionCardSkeleton } from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useErrorSheet } from '@/hooks/useErrorSheet';
import { useSkeletonGate } from '@/hooks/useSkeletonGate';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, REFRESH_CONTROL } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import {
  providerHomeActionButton,
  providerHomeActionLabel,
  providerHomeSurface,
  providerHomeSurfacePadding,
  providerUnderlineTabItem,
  providerUnderlineTabLabel,
  providerUnderlineTabRow,
} from '@/lib/providerSurfaceStyles';
import { walletService } from '@/services/api';
import { openClientReceipt } from '@/utils/receiptNavigation';
import { isCancelledWalletTransaction, extractWalletTransactionFailureReason, mapWalletTransactionStatus, walletTransactionTimestamp } from '@/utils/walletTransactions';
import { useRouter, useFocusEffect } from 'expo-router';
import { CheckCircle, Clock, Filter, Receipt, XCircle } from 'lucide-react-native';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Transaction {
  id: string;
  serviceName: string;
  serviceDescription: string;
  date: string;
  time: string;
  /** Raw ISO timestamp — `date`/`time` are display strings and can't be compared. */
  timestamp: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  requestId?: string;
  reference?: string;
  failureReason?: string;
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
      ) : (
        <TouchableOpacity
          onPress={() => onViewDetails(transaction)}
          style={{ ...providerHomeActionButton, width: '100%' }}
          activeOpacity={0.85}
        >
          <Text style={providerHomeActionLabel}>View details</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function ActivityScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'completed' | 'pending' | 'failed'>('completed');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_TRANSACTION_FILTERS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** The thrown error itself — the sheet needs its status, not just a string. */
  const [transactionsError, setTransactionsError] = useState<unknown>(null);
  /** Keeps loaded rows on screen when the tab is revisited — only the first load shows skeletons. */
  const transactionsReadyRef = useRef(false);

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

      const status = mapWalletTransactionStatus(apiTransaction);
      const timestamp = walletTransactionTimestamp(apiTransaction);
      const { date, time } = formatDate(timestamp);

      return {
        id: String(apiTransaction.id || apiTransaction.reference || Math.random()),
        serviceName,
        serviceDescription,
        date,
        time,
        timestamp,
        amount: Math.abs(apiTransaction.amount || 0), // Use absolute value for display
        status,
        requestId: apiTransaction.requestId != null ? String(apiTransaction.requestId) : undefined,
        reference: apiTransaction.reference ? String(apiTransaction.reference) : undefined,
        failureReason: status === 'failed' ? extractWalletTransactionFailureReason(apiTransaction) : undefined,
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
      if (!transactionsReadyRef.current) {
        setIsLoading(true);
      }
      const result = await walletService.getTransactions({ limit: 100, offset: 0 });
      const mappedTransactions = result.transactions
        .map(mapTransactionToUI)
        .filter((t): t is Transaction => t !== null);
      setTransactions(mappedTransactions);
      setTransactionsError(null);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading transactions:', error);
      }
      setTransactionsError(error);
    } finally {
      transactionsReadyRef.current = true;
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

  const hasActiveFilters =
    appliedFilters.dateRange !== null ||
    appliedFilters.sortBy !== DEFAULT_TRANSACTION_FILTERS.sortBy;

  /** Inclusive lower bound for the selected range, or null when unfiltered. */
  const dateRangeStart = useMemo(() => {
    if (!appliedFilters.dateRange) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (appliedFilters.dateRange === 'thisWeek') {
      // Week starts Sunday, matching the en-US formatting used on the rows.
      start.setDate(start.getDate() - start.getDay());
    } else if (appliedFilters.dateRange === 'thisMonth') {
      start.setDate(1);
    }
    return start.getTime();
  }, [appliedFilters.dateRange]);

  // Filter by tab, search and applied date range, then apply the chosen sort.
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = transactions.filter((transaction) => {
      if (transaction.status !== selectedTab) return false;

      if (
        query !== '' &&
        !transaction.serviceName.toLowerCase().includes(query) &&
        !transaction.serviceDescription.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (dateRangeStart !== null) {
        const time = new Date(transaction.timestamp).getTime();
        // An unparseable timestamp shouldn't silently drop the row from an
        // otherwise valid date window.
        if (Number.isFinite(time) && time < dateRangeStart) return false;
      }

      return true;
    });

    const byTime = (t: Transaction) => new Date(t.timestamp).getTime() || 0;
    return matched.sort((a, b) => {
      switch (appliedFilters.sortBy) {
        case 'oldest':
          return byTime(a) - byTime(b);
        case 'highToLow':
          return b.amount - a.amount;
        case 'lowToHigh':
          return a.amount - b.amount;
        default:
          return byTime(b) - byTime(a);
      }
    });
  }, [transactions, selectedTab, searchQuery, dateRangeStart, appliedFilters.sortBy]);

  const handleViewDetails = (transaction: Transaction) => {
    if (transaction.status === 'pending') {
      router.push({
        pathname: '/PaymentPendingScreen',
        params: {
          transactionId: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount.toString(),
          providerName: transaction.serviceName,
          serviceName: transaction.serviceDescription,
          totalAmount: transaction.amount.toFixed(2),
          paymentMethod: 'Wallet',
          serviceDate: transaction.date,
          serviceTime: transaction.time,
          initiatedDate: `${transaction.date} · ${transaction.time}`,
        },
      } as any);
    } else if (transaction.status === 'failed') {
      router.push({
        pathname: '/TransactionFailedScreen',
        params: {
          transactionId: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount.toString(),
          providerName: transaction.serviceName,
          serviceName: transaction.serviceDescription,
          totalAmount: transaction.amount.toFixed(2),
          paymentMethod: 'Wallet',
          serviceDate: transaction.date,
          serviceTime: transaction.time,
          initiatedDate: `${transaction.date} · ${transaction.time}`,
          failureReason: transaction.failureReason,
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
              ...(hasActiveFilters
                ? { borderColor: Colors.accent, backgroundColor: Colors.sageTint }
                : null),
            }}
            activeOpacity={0.85}
            accessibilityLabel={hasActiveFilters ? 'Filter transactions, filters active' : 'Filter transactions'}
            accessibilityHint="Opens filter options"
          >
            <Filter size={18} color={hasActiveFilters ? Colors.accent : Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ ...providerUnderlineTabRow, marginBottom: 16 }}>
          {(['completed', 'pending', 'failed'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setSelectedTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab === tab }}
              accessibilityLabel={`${tab} transactions`}
              style={providerUnderlineTabItem(selectedTab === tab)}
              activeOpacity={0.7}
            >
              <Text style={{ ...providerUnderlineTabLabel(selectedTab === tab), textTransform: 'capitalize' }}>
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
      hasActiveFilters,
      pendingCount,
      searchQuery,
      selectedTab,
      totalSpent,
      totalTransactions,
    ]
  );

  const { showSkeleton, isLoadingEmpty } = useSkeletonGate(
    isLoading,
    transactions.length === 0 && !transactionsError
  );

  useErrorSheet({
    error: transactionsError,
    subject: 'your transactions',
    hasContent: transactions.length > 0,
    onRetry: loadTransactions,
  });

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
    if (showSkeleton || isLoadingEmpty) {
      return (
        <>
          <TransactionCardSkeleton />
          <TransactionCardSkeleton />
          <TransactionCardSkeleton />
        </>
      );
    }
    if (transactionsError && transactions.length === 0) {
      // Failed: hold the list's real shape, dimmed and still. ErrorSheet explains it.
      return (
        <View style={{ opacity: 0.35 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <TransactionCardSkeleton />
          <TransactionCardSkeleton />
          <TransactionCardSkeleton />
        </View>
      );
    }
    // A date filter hiding every row must not read as "you have none".
    const filteredEverythingOut = hasActiveFilters && transactions.length > 0;
    return (
      <EmptyState
        icon={<Receipt size={40} color={Colors.textSecondaryDark} />}
        title={
          searchQuery || filteredEverythingOut
            ? 'No matching transactions'
            : `No ${selectedTab} transactions`
        }
        description={
          searchQuery
            ? 'No transactions match your search'
            : filteredEverythingOut
              ? 'No transactions match the filters you applied. Try a wider date range.'
              : `You don't have any ${selectedTab} transactions yet`
        }
        style={{
          flex: 0,
          ...providerHomeSurface,
          padding: providerHomeSurfacePadding + 18,
        }}
      />
    );
  }, [showSkeleton, isLoadingEmpty, hasActiveFilters, loadTransactions, searchQuery, selectedTab, transactions.length, transactionsError]);

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <ScreenHeader title="Activity" onBack={() => router.back()} backgroundColor={Colors.backgroundLight} />
      <FlatList
        data={showSkeleton || isLoadingEmpty ? [] : filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        appliedFilters={appliedFilters}
        onClose={() => setShowFilterModal(false)}
        onApply={setAppliedFilters}
      />
    </SafeAreaWrapper>
  );
}
