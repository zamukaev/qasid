import { View } from "react-native";

type Props = {
  className?: string;
};

export default function FeaturedCardSkeleton({ className = "" }: Props) {
  return (
    <View className={`overflow-hidden rounded-2xl border border-qasid-gold/20 bg-qasid-card ${className}`}>
      <View className="w-80 min-h-[168px] p-6">
        <View className="flex-row items-center">
          <View
            className="h-28 w-28 rounded-2xl bg-gray-700/30 animate-pulse mr-4"
            style={{
              shadowColor: "#E7C11C",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.18,
              shadowRadius: 8,
              elevation: 4,
            }}
          />

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <View className="h-3 w-16 rounded bg-gray-700/25 animate-pulse" />
              <View className="h-2.5 w-2.5 rounded-full bg-gray-700/25 animate-pulse" />
            </View>
            <View className="h-5 w-40 rounded bg-gray-700/30 animate-pulse" />
            <View className="h-3 w-24 rounded mt-3 bg-gray-700/20 animate-pulse" />
          </View>
        </View>
      </View>
    </View>
  );
}
