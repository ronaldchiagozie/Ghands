import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Copy } from 'lucide-react-native';

export type PromoCode = {
  id: string;
  code: string;
  description: string;
};

type PromoCodeCardProps = {
  promo: PromoCode;
};

const PromoCodeCardComponent = ({ promo }: PromoCodeCardProps) => {
  return (
    <View className="bg-[#F8FAFC] rounded-xl px-4 py-5 border border-dashed border-[#E2E8F0]">
      <View className="flex-row items-center justify-between">
        <View>
          <Text
            className="text-sm text-black"
            style={{ fontFamily: 'Poppins-SemiBold' }}
          >
            {promo.code}
          </Text>
          <Text
            className="text-xs text-gray-500 mt-1"
            style={{ fontFamily: 'Poppins-Medium' }}
          >
            {promo.description}
          </Text>
        </View>
        <TouchableOpacity className="bg-[#2563EB] px-4 py-2 rounded-xl flex-row items-center">
          <Copy size={14} color="#FFFFFF" />
          <Text
            className="text-white text-xs font-semibold ml-2"
            style={{ fontFamily: 'Poppins-SemiBold' }}
          >
            Copy
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const PromoCodeCard = React.memo(PromoCodeCardComponent);

export default PromoCodeCard;

