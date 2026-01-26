import { Ionicons } from "@expo/vector-icons";

import { View, Text } from "react-native";
import { formatMillis } from "../utils";

export const Progressbar = ({
  progressPercent,
  resumeMillis,
}: {
  progressPercent: number;
  resumeMillis: number;
}) => {
  return (
    <View className="flex-row items-center mt-2">
      <View className="flex-row items-center bg-qasid-gold/15 border border-qasid-gold/30 rounded-full px-3 py-1">
        <Ionicons
          name="time-outline"
          size={14}
          color="#E7C11C"
          style={{ marginRight: 6 }}
        />
        <Text className="text-qasid-gold text-xs font-medium">
          In progress · {progressPercent}%
        </Text>
        <Text className="text-qasid-white/60 text-xs ml-2">
          Resume {formatMillis(resumeMillis)}
        </Text>
      </View>
    </View>
  );
};
