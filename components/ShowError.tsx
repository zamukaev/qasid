import { SafeAreaView, Text } from "react-native";

interface ShowErrorProps {
  message: string;
}
export default function ShowError({ message }: ShowErrorProps) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black px-6">
      <Text className="text-qasid-gold text-center text-base">{message}</Text>
    </SafeAreaView>
  );
}
