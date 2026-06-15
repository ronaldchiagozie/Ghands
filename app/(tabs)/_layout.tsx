import { MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CLIENT_TAB_BAR_BASE_HEIGHT,
} from '@/lib/tabletLayout';
import { Colors, runParallel, useReducedMotion } from '@/lib/designSystem';
import { surfaceElevation } from '@/lib/surfaceStyles';

type IconName = keyof typeof MaterialIcons.glyphMap;

const AnimatedIcon = ({ iconName, color, focused }: { iconName: IconName; color: string; focused: boolean }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.7)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      scaleAnim.setValue(focused ? 1.15 : 1);
      opacityAnim.setValue(focused ? 1 : 0.6);
      translateYAnim.setValue(focused ? -2 : 0);
      return;
    }

    runParallel(reducedMotion, [
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.15 : 1,
        tension: 400,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0.6,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: focused ? -2 : 0,
        tension: 400,
        friction: 8,
        useNativeDriver: true,
      }),
    ]);
  }, [focused, reducedMotion, scaleAnim, opacityAnim, translateYAnim]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale: scaleAnim },
          { translateY: translateYAnim }
        ],
        opacity: opacityAnim,
      }}
    >
      <MaterialIcons name={iconName} size={Platform.OS === 'android' ? 19 : 20} color={color} />
    </Animated.View>
  );
};

const CentralTabButton = ({ children, onPress }: BottomTabBarButtonProps) => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          top: -14,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            paddingTop: 13,
            borderRadius: 31,
            display: 'flex',
            backgroundColor: Colors.accent,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#101828',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: surfaceElevation(4),
            borderWidth: 3,
            borderColor: '#FFFFFF',
          }}
        >
          {children}
        </View>
      </TouchableOpacity>
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Poppins-Medium',
          color: Colors.accent,
          marginTop: -8,
          position: 'absolute',
          bottom: 0,
        }}
      >
   
      </Text>
    </View>
  );
};


export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: '#ffffff',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(17, 24, 39, 0.1)',
      height: CLIENT_TAB_BAR_BASE_HEIGHT + insets.bottom,
      paddingBottom: insets.bottom,
      paddingTop: 2,
      marginHorizontal: 0,
      marginBottom: 0,
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    }),
    [insets.bottom]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarItemStyle: { paddingVertical: 0, marginTop: 0 },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Poppins-Medium',
          marginTop: 0,
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon iconName="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon iconName="explore" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Request',
          tabBarLabel: '',
          tabBarIcon: () => <MaterialIcons name="add" size={30} color="white" />,
          tabBarButton: (props) => (
            <CentralTabButton
              {...props}
              onPress={() => router.push({ pathname: '/request-service', params: { fromAddButton: '1' } })}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarLabel: 'Jobs',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon iconName="assignment" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon iconName="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
