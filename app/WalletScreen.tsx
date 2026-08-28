import { EmptyState } from '@/components/EmptyState';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import {
    SageAmountSkeleton,
    TransactionCardSkeleton,
} from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useErrorSheet } from '@/hooks/useErrorSheet';
import { useSkeletonGate } from '@/hooks/useSkeletonGate';
import { invalidateWalletBalanceCache, useWalletBalance } from '@/hooks/useWalletBalance';
import { BorderRadius, Colors } from '@/lib/designSystem';
import {
    providerHomeActionButton,
    providerHomeActionLabel,
    providerHomeSectionTitle,
    providerHomeSurface,
    providerHomeSurfacePadding,
    providerHomeViewAllLabel,
} from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { walletService } from '@/services/api';
import { openClientReceipt } from '@/utils/receiptNavigation';
import { extractWalletTransactionFailureReason, isCancelledWalletTransaction, mapWalletTransactionStatus, walletTransactionTimestamp } from '@/utils/walletTransactions';

import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, Bell, Building2, CheckCircle, Clock, Plus, Receipt, Wallet, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface Transaction {
  id: string;
  serviceName: string;
  serviceDescription: string;
  date: string;
  time: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  requestId?: string;
  reference?: string;
  failureReason?: string;
}

export default function WalletScreen() {
  const router = useRouter();
  const {
    balance,
    walletId,
    isLoading: isLoadingBalance,
    balanceError,
    refresh: refreshWalletBalance,
  } = useWalletBalance({
    refreshOnFocus: true,
  });
  const transactionsReadyRef = useRef(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  /** The thrown error itself — the sheet needs its status, not just a string. */
  const [transactionsError, setTransactionsError] = useState<unknown>(null);

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
      
      // Prefer ledger type from API (backend source of truth)
      const txType = String(apiTransaction.type ?? '').toLowerCase();
      if (txType === 'deposit') {
        serviceName = 'Wallet Deposit';
        serviceDescription = 'Funds added to wallet';
      } else if (txType === 'withdrawal') {
        serviceName = 'Withdrawal';
        serviceDescription = 'Funds withdrawn to bank';
      } else if (txType === 'payment') {
        serviceName = apiTransaction.requestId
          ? `Service Request #${apiTransaction.requestId}`
          : 'Service Payment';
        serviceDescription = apiTransaction.description || 'Wallet payment';
      } else if (apiTransaction.description) {
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
      const { date, time } = formatDate(walletTransactionTimestamp(apiTransaction));
      const failureReason =
        status === 'failed' ? extractWalletTransactionFailureReason(apiTransaction) : undefined;

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
        failureReason,
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
    if (!transactionsReadyRef.current) {
      setIsLoadingTransactions(true);
    }
    try {
      const result = await walletService.getTransactions({ limit: 15, offset: 0 });
      const mappedTransactions = result.transactions
        .map(mapTransactionToUI)
        .filter((t): t is Transaction => t !== null)
        // Hide pending Wallet Deposits from Recent Activity - they're in-process top-ups, not settled
        .filter((t) => !(t.serviceName === 'Wallet Deposit' && t.status === 'pending'))
        .slice(0, 5);
      setTransactions(mappedTransactions);
      setTransactionsError(null);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading transactions:', error);
      }
      setTransactionsError(error);
    } finally {
      transactionsReadyRef.current = true;
      setIsLoadingTransactions(false);
    }
  }, [mapTransactionToUI]);

  // Load transactions on mount
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Refresh transactions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      invalidateWalletBalanceCache();
      loadTransactions();
      void refreshWalletBalance({ silent: true });
    }, [loadTransactions, refreshWalletBalance])
  );

  const handleAddFunds = useCallback(() => {
    router.push('/TopUpScreen' as any);
  }, [router]);

  const handleWithdraw = useCallback(() => {
    router.push('/WithdrawScreen' as any);
  }, [router]);

  const handleViewAll = useCallback(() => {
    router.push('/ActivityScreen' as any);
  }, [router]);

  const handleViewDetails = useCallback((transaction: Transaction) => {
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
  }, [router]);

  const handleViewReceipt = useCallback((transaction: Transaction) => {
    openClientReceipt(router, {
      transactionId: transaction.id,
      requestId: transaction.requestId,
      reference: transaction.reference,
      providerName: transaction.serviceName,
      serviceName: transaction.serviceDescription,
      amount: transaction.amount.toString(),
      status: transaction.status,
      serviceDate: transaction.date,
      serviceTime: transaction.time,
      paymentDate: `${transaction.date} at ${transaction.time}`,
    });
  }, [router]);

  const handleViewFailedTransaction = useCallback((transaction: Transaction) => {
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
  }, [router]);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  const balanceLoadFailed = Boolean(balanceError && balance === null);
  const { showSkeleton: showBalanceSkeleton, isLoadingEmpty: isBalanceLoadingEmpty } =
    useSkeletonGate(isLoadingBalance, balance === null && !balanceLoadFailed);
  const { showSkeleton: showTransactionsSkeleton, isLoadingEmpty: isTransactionsLoadingEmpty } =
    useSkeletonGate(isLoadingTransactions, transactions.length === 0 && !transactionsError);

  useErrorSheet({
    error: transactionsError,
    subject: 'your recent activity',
    hasContent: transactions.length > 0,
    onRetry: loadTransactions,
  });

  const handleRetryBalance = useCallback(() => {
    void refreshWalletBalance();
  }, [refreshWalletBalance]);

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader
        title="Wallet"
        onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)}
        backgroundColor={Colors.backgroundLight}
        rightElement={
          <TouchableOpacity
            onPress={() => router.push('../NotificationsScreen' as any)}
            style={{ position: 'relative', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
            accessibilityHint="Opens notifications screen"
          >
            <Bell size={24} color={Colors.textPrimary} />
            <View
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: Colors.accent,
              }}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
          paddingBottom: 100,
        }}
      >
        {/* Balance — sage panel (matches provider wallet) */}
        <View
          style={{
            borderRadius: 16,
            backgroundColor: Colors.accent,
            borderWidth: 1,
            borderColor: Colors.sagePanelBorder,
            paddingVertical: 17,
            paddingHorizontal: 15,
            marginTop: 12,
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -38,
              right: -32,
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: '#FFFFFF',
              opacity: 0.1,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -54,
              left: -42,
              width: 132,
              height: 132,
              borderRadius: 66,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              {walletId != null && (
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.white,
                    opacity: 0.55,
                    marginBottom: 4,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                  numberOfLines={1}
                >
                  GH-WLT-{String(walletId).padStart(8, '0')}
                </Text>
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.border,
                }}
              >
                Available balance
              </Text>
            </View>
            <View
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.11)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                padding: 8,
                borderRadius: 999,
              }}
            >
              <Wallet size={14} color={Colors.white} strokeWidth={2.2} />
            </View>
          </View>

          {(showBalanceSkeleton || isBalanceLoadingEmpty) ? (
            <SageAmountSkeleton />
          ) : balanceLoadFailed ? (
            <View style={{ marginBottom: 10 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.white,
                  marginBottom: 6,
                }}
              >
                Could not load balance
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.white,
                  opacity: 0.85,
                  lineHeight: 19,
                  marginBottom: 12,
                }}
              >
                {balanceError}
              </Text>
              <TouchableOpacity
                onPress={handleRetryBalance}
                activeOpacity={0.85}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: BorderRadius.default,
                  backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.22)',
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            <Text
              style={{
                fontSize: 27,
                fontFamily: 'Poppins-Bold',
                color: Colors.white,
                marginBottom: 10,
                lineHeight: 30,
                letterSpacing: -0.8,
              }}
            >
              ₦{(balance ?? 0).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.15)',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.white,
                  opacity: 0.65,
                  marginBottom: 4,
                }}
              >
                Recent activity
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.white,
                }}
              >
                {showTransactionsSkeleton || isTransactionsLoadingEmpty
                  ? '…'
                  : transactionsError && transactions.length === 0
                    ? '—'
                    : transactions.length}
              </Text>
            </View>
            <View
              style={{
                width: 1,
                height: 28,
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                marginHorizontal: 14,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.white,
                  opacity: 0.65,
                  marginBottom: 4,
                }}
              >
                Wallet status
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.45)',
                    marginRight: 6,
                  }}
                />
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.white,
                  }}
                >
                  Active
                </Text>
              </View>
            </View>
          </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            onPress={handleAddFunds}
            style={{
              flex: 1,
              ...providerHomeActionButton,
            }}
            activeOpacity={0.85}
          >
            <Plus size={16} color={Colors.accent} />
            <Text style={{ ...providerHomeActionLabel, marginLeft: 6 }}>Add funds</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWithdraw}
            style={{
              flex: 1,
              ...providerHomeActionButton,
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Withdraw to bank"
          >
            <Building2 size={16} color={Colors.accent} />
            <Text style={{ ...providerHomeActionLabel, marginLeft: 6 }} numberOfLines={1}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Section */}
        <View style={{ marginTop: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={providerHomeSectionTitle}>Recent Activity</Text>
            <TouchableOpacity
              onPress={handleViewAll}
              style={{ flexDirection: 'row', alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Text style={{ ...providerHomeViewAllLabel, marginRight: 4 }}>View all</Text>
              <ArrowRight size={14} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Transaction Cards */}
          {(showTransactionsSkeleton || isTransactionsLoadingEmpty) ? (
            <>
              <TransactionCardSkeleton />
              <TransactionCardSkeleton />
              <TransactionCardSkeleton />
            </>
          ) : transactionsError && transactions.length === 0 ? (
            // Failed: hold the list's real shape, dimmed and still. ErrorSheet explains it.
            <View style={{ opacity: 0.35 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TransactionCardSkeleton />
              <TransactionCardSkeleton />
              <TransactionCardSkeleton />
            </View>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Receipt size={40} color={Colors.textSecondaryDark} />}
              title="No transactions yet"
              description="Completed payments, top-ups, and refunds will appear here once they settle."
              style={{
                flex: 0,
                ...providerHomeSurface,
                padding: providerHomeSurfacePadding + 18,
              }}
            />
          ) : (
            transactions.map((transaction) => (
            <View
              key={transaction.id}
              style={{
                ...providerHomeSurface,
                padding: providerHomeSurfacePadding,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginBottom: 10,
                }}
              >
                {/* Circular icon on left - light grey background */}
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

                {/* Service Info */}
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
                    {transaction.date} • {transaction.time}
                  </Text>
                </View>

                {/* Status and Amount on right */}
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
                            ? 'rgba(245, 158, 11, 0.18)'
                            : Colors.errorLight,
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
                    ₦{formatCurrency(transaction.amount)}
                  </Text>
                </View>
              </View>

              {/* Action Button at bottom */}
              {transaction.status === 'completed' ? (
                <TouchableOpacity
                  onPress={() => handleViewReceipt(transaction)}
                  style={{
                    ...providerHomeActionButton,
                    width: '100%',
                  }}
                  activeOpacity={0.85}
                >
                  <Receipt size={15} color={Colors.textPrimary} style={{ marginRight: 5 }} />
                  <Text style={providerHomeActionLabel}>View Receipt</Text>
                </TouchableOpacity>
              ) : transaction.status === 'pending' ? (
                <TouchableOpacity
                  onPress={() => handleViewDetails(transaction)}
                  style={{
                    ...providerHomeActionButton,
                    width: '100%',
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={providerHomeActionLabel}>View details</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => handleViewFailedTransaction(transaction)}
                  style={{
                    ...providerHomeActionButton,
                    width: '100%',
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={providerHomeActionLabel}>View details</Text>
                </TouchableOpacity>
              )}
            </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
