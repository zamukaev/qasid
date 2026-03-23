import React from "react";
import { Pressable, Text, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

interface HomeSectionHeaderProps {
  title: string;
  onPress?: () => void;
  actionLabel?: string;
}

function HomeSectionHeader({
  title,
  onPress,
  actionLabel,
}: HomeSectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-5">
      <Text className="text-qasid-white text-[22px] font-bold tracking-tight">
        {title}
      </Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          hitSlop={12}
          className="flex-row items-center rounded-full border border-qasid-gold/20 bg-qasid-gold/5 px-3 py-2"
          android_ripple={{ color: "#E7C11C22" }}
        >
          <Text className="mr-2 text-qasid-gold text-xs font-semibold uppercase tracking-[1.4px]">
            {actionLabel ?? "See all"}
          </Text>
          <FontAwesome6 name="chevron-right" size={9} color="#E7C11C" />
        </Pressable>
      ) : null}
    </View>
  );
}

export default React.memo(HomeSectionHeader);
