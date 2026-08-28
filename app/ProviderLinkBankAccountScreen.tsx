import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { walletService, type Bank } from '@/services/api';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { NIGERIA_FALLBACK_BANKS } from '@/utils/nigeriaFallbackBanks';
import { useRouter } from 'expo-router';
import { Building2, ChevronDown, Lock, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const fieldCard = {
  ...providerListCard,
  backgroundColor: Colors.white,
  borderColor: 'rgba(17, 24, 39, 0.045)',
} as const;

export default function ProviderLinkBankAccountScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [usedFallbackBanks, setUsedFallbackBanks] = useState(false);

  const applyBankList = useCallback((list: Bank[], fromFallback: boolean) => {
    setBanks(list);
    setUsedFallbackBanks(fromFallback);
  }, []);

  const loadBanks = useCallback(async () => {
    try {
      setIsLoadingBanks(true);
      const list = await walletService.getBanks('NG');
      if (list.length > 0) {
        applyBankList(list, false);
        return;
      }
      applyBankList([...NIGERIA_FALLBACK_BANKS], true);
    } catch (err) {
      applyBankList([...NIGERIA_FALLBACK_BANKS], true);
      showError(
        getSpecificErrorMessage(err, 'default') ||
          'Unable to load bank list from server. Showing common Nigerian banks instead.',
      );
    } finally {
      setIsLoadingBanks(false);
    }
  }, [applyBankList, showError]);

  useEffect(() => {
    if (!showBankModal) return;
    void loadBanks();
  }, [showBankModal, loadBanks]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q) || b.code.includes(q));
  }, [banks, bankSearch]);

  const resolveAccount = useCallback(async () => {
    if (!selectedBank?.code || accountNumber.trim().length !== 10) return;
    try {
      setIsResolving(true);
      const result = await walletService.resolveBankAccount(selectedBank.code, accountNumber.trim());
      const name = result.accountName?.trim() || '';
      setAccountHolderName(name);
      if (name) haptics.success();
    } catch {
      showError('Could not verify account. Check the number and try again.');
    } finally {
      setIsResolving(false);
    }
  }, [selectedBank?.code, accountNumber, showError]);

  const handleSave = async () => {
    if (!selectedBank || !accountNumber.trim() || !accountHolderName.trim()) {
      showError('Please fill in all fields');
      return;
    }
    if (accountNumber.trim().length !== 10) {
      showError('Account number must be 10 digits');
      return;
    }
    try {
      setIsSaving(true);
      await walletService.addBankAccount({
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountNumber: accountNumber.trim(),
      });
      haptics.success();
      showSuccess('Bank account linked');
      router.back();
    } catch (err) {
      showError(getSpecificErrorMessage(err, 'default') || 'Could not link bank account');
    } finally {
      setIsSaving(false);
    }
  };

  const openBankModal = () => {
    haptics.light();
    setShowBankModal(true);
  };

  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setShowBankModal(false);
    setBankSearch('');
    haptics.selection();
  };

  const canVerify = !!selectedBank?.code && accountNumber.trim().length === 10 && !isResolving;

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader
        title="Link bank account"
        onBack={() => navigateBack(router, '/WalletScreen')}
        backgroundColor={Colors.backgroundLight}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingBottom: 40,
        }}
      >
        <Text
          style={{
            fontFamily: 'Poppins-Regular',
            fontSize: 14,
            lineHeight: 20,
            color: Colors.textSecondaryDark,
            marginBottom: 20,
          }}
        >
          Used for withdrawals. Pick your bank, verify your account number, then save.
        </Text>

        <Text
          style={{
            fontFamily: 'Poppins-SemiBold',
            fontSize: 15,
            color: Colors.textPrimary,
            marginBottom: 8,
          }}
        >
          Bank
        </Text>
        <TouchableOpacity
          onPress={openBankModal}
          activeOpacity={0.85}
          style={{
            ...fieldCard,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Building2 size={20} color={Colors.textSecondaryDark} style={{ marginRight: 12 }} />
          <Text
            style={{
              flex: 1,
              fontFamily: 'Poppins-Medium',
              fontSize: 15,
              color: selectedBank ? Colors.textPrimary : Colors.placeholder,
            }}
          >
            {selectedBank?.name ?? 'Select bank'}
          </Text>
          <ChevronDown size={20} color={Colors.textSecondaryDark} />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: 'Poppins-SemiBold',
            fontSize: 15,
            color: Colors.textPrimary,
            marginBottom: 8,
          }}
        >
          Account number
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TextInput
            value={accountNumber}
            onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit account number"
            placeholderTextColor={Colors.placeholder}
            keyboardType="number-pad"
            maxLength={10}
            style={{
              ...fieldCard,
              flex: 1,
              padding: 16,
              fontFamily: 'Poppins-Medium',
              fontSize: 16,
              color: Colors.textPrimary,
            }}
          />
          <TouchableOpacity
            onPress={() => void resolveAccount()}
            disabled={!canVerify}
            activeOpacity={0.85}
            style={{
              ...fieldCard,
              paddingHorizontal: 18,
              justifyContent: 'center',
              minHeight: 52,
              opacity: canVerify ? 1 : 0.55,
            }}
          >
            {isResolving ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.textPrimary }}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontFamily: 'Poppins-SemiBold',
            fontSize: 15,
            color: Colors.textPrimary,
            marginBottom: 8,
          }}
        >
          Account name
        </Text>
        <TextInput
          value={accountHolderName}
          onChangeText={setAccountHolderName}
          placeholder="Filled after you verify"
          placeholderTextColor={Colors.placeholder}
          style={{
            ...fieldCard,
            padding: 16,
            fontFamily: 'Poppins-Medium',
            fontSize: 15,
            color: Colors.textPrimary,
            marginBottom: 16,
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28, gap: 8 }}>
          <Lock size={15} color={Colors.textSecondaryDark} />
          <Text
            style={{
              flex: 1,
              fontFamily: 'Poppins-Regular',
              fontSize: 13,
              color: Colors.textSecondaryDark,
            }}
          >
            Your bank details are protected
          </Text>
        </View>

        <Button
          title="Link account"
          onPress={() => void handleSave()}
          variant="secondary"
          size="large"
          fullWidth
          loading={isSaving}
          disabled={isSaving || isResolving}
          style={{ backgroundColor: Colors.black }}
        />
      </ScrollView>

      <Modal
        visible={showBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowBankModal(false)} />
          <View
            style={{
              backgroundColor: Colors.white,
              borderTopLeftRadius: BorderRadius.xl,
              borderTopRightRadius: BorderRadius.xl,
              maxHeight: '75%',
              paddingBottom: 28,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 18, color: Colors.textPrimary }}>Select bank</Text>
              <TouchableOpacity
                onPress={() => setShowBankModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close"
              >
                <X size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search banks"
                placeholderTextColor={Colors.placeholder}
                autoCorrect={false}
                style={{
                  ...fieldCard,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: 'Poppins-Regular',
                  fontSize: 15,
                  color: Colors.textPrimary,
                }}
              />
              {usedFallbackBanks && !isLoadingBanks ? (
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  Showing common Nigerian banks — server list unavailable.
                </Text>
              ) : null}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            >
              {isLoadingBanks ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator color={Colors.accent} />
                </View>
              ) : filteredBanks.length === 0 ? (
                <Text
                  style={{
                    paddingVertical: 24,
                    textAlign: 'center',
                    fontFamily: 'Poppins-Regular',
                    fontSize: 14,
                    color: Colors.textSecondaryDark,
                  }}
                >
                  {bankSearch.trim() ? `No banks match “${bankSearch.trim()}”` : 'No banks to show.'}
                </Text>
              ) : (
                filteredBanks.map((bank) => (
                  <TouchableOpacity
                    key={`${bank.code}-${bank.name}`}
                    onPress={() => handleBankSelect(bank)}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: Colors.border,
                    }}
                  >
                    <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textPrimary }}>
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
}
