import { SafeAreaView, ActivityIndicator, Text } from "react-native";

interface LoaderProps {
  message: string;
}

export const Loader = ({ message }: LoaderProps) => {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black">
      <ActivityIndicator size="small" color="#E7C11C" />
      <Text className="text-qasid-gold mt-3">{message}</Text>
    </SafeAreaView>
  );
};
