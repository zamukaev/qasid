import { View, Text } from "react-native";
import { ScreenLayout } from "../../../components";

export default function Settings() {
  return (
    <ScreenLayout>
      <View className="flex-1 items-center justify-center h-full">
        <Text className="text-qasid-gold text-xl">Settings Screen</Text>
      </View>
    </ScreenLayout>
  );
}
