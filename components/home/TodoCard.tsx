import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type TodoCardConfig = {
  id: string;
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

const TodoCardComponent = ({ title, iconName, onPress }: TodoCardConfig) => {
  return (
    <TouchableOpacity
      className="w-40 bg-gray-100 py-4 pl-2 pr-4 rounded-xl mr-3"
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
    >
      <View className="flex">
        <View className="w-12 h-12 rounded-full  items-center justify-center">
          <Ionicons name={iconName} size={20} color="#1F2937"/>
        </View>
        <Text
          className="text-sm pr-3 py-2"
          style={{ fontFamily: 'Poppins-Medium' }}
        >
          {title}
        </Text>
        <View className="absolute right-0 top-8">
          <Ionicons name="chevron-forward-outline" color="gray" size={20} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const TodoCard = React.memo(TodoCardComponent);

export default TodoCard;

