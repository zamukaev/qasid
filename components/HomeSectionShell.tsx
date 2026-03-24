import React from "react";
import { View } from "react-native";
import HomeSectionHeader from "./HomeSectionHeader";

const SECTION_CONTAINER_CLASS = "px-4 py-9";

interface HomeSectionShellProps {
  title: string;
  children: React.ReactNode;
  onPressSeeAll?: () => void;
  actionLabel?: string;
  className?: string;
}

function HomeSectionShell({
  title,
  children,
  onPressSeeAll,
  actionLabel,
  className = "",
}: HomeSectionShellProps) {
  return (
    <View className={`${SECTION_CONTAINER_CLASS} ${className}`}>
      <HomeSectionHeader
        title={title}
        onPress={onPressSeeAll}
        actionLabel={actionLabel}
      />
      {children}
    </View>
  );
}

export default React.memo(HomeSectionShell);
