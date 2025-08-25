import React from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenLayoutProps {
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
  safeArea?: boolean;
  safeAreaClassName?: string;
}

export default function ScreenLayout({
  children,
  style,
  className = "flex-1 bg-qasid-black",
  safeArea = true,
  safeAreaClassName = "flex-1",
}: ScreenLayoutProps) {
  const content = (
    <View className={className} style={style}>
      {children}
    </View>
  );

  if (safeArea) {
    return <SafeAreaView className={safeAreaClassName}>{content}</SafeAreaView>;
  }

  return content;
}
