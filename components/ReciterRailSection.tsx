import React from "react";
import { FirebaseReciter } from "../types/quran";
import { CompactReciterCard, CompactReciterCardVariantProps } from "./ReciterCard";
import CompactReciterCardSkeleton from "./CompactReciterCardSkeleton";
import HorizontalRailSection from "./HorizontalRailSection";

interface ReciterRailSectionProps extends CompactReciterCardVariantProps {
  title: string;
  reciters: FirebaseReciter[];
  isLoading?: boolean;
  onPressSeeAll?: () => void;
  skeletonCount?: number;
}

function ReciterRailSection({
  title,
  reciters,
  isLoading = false,
  onPressSeeAll,
  skeletonCount = 8,
  circle,
  large,
  small,
}: ReciterRailSectionProps) {
  return (
    <HorizontalRailSection
      title={title}
      items={reciters}
      isLoading={isLoading}
      onPressSeeAll={onPressSeeAll}
      skeletonCount={skeletonCount}
      keyExtractor={(r) => r.id.toString()}
      renderItem={(r) => <CompactReciterCard reciter={r} circle={circle} large={large} small={small} />}
      renderSkeleton={(_) => <CompactReciterCardSkeleton circle={circle} large={large} small={small} />}
    />
  );
}

export default React.memo(ReciterRailSection);
