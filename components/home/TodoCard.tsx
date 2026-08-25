import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type TodoCardConfig = {
  id: string;
  title: string;
  Icon: LucideIcon;
  onPress?: () => void;
};

const TodoCardComponent = ({ title, Icon, onPress }: TodoCardConfig) => {
  return (
    <TouchableOpacity
      className="w-40 bg-gray-100 py-4 pl-2 pr-4 rounded-xl mr-3"
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
    >
      <View className="flex">
        <View className="w-12 h-12 rounded-full  items-center justify-center">
          <Icon size={20} color="#1F2937" />
        </View>
        <Text
          className="text-sm pr-3 py-2"
          style={{ fontFamily: 'Poppins-Medium' }}
        >
          {title}
        </Text>
        <View className="absolute right-0 top-8">
          <ChevronRight color="gray" size={20} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const TodoCard = React.memo(TodoCardComponent);

export default TodoCard;

