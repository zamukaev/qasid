import { Button, Pressable, Text, View } from "react-native";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { Stack } from "expo-router";
import { ScreenLayout } from "../../../components";
export default function Quran() {
  const auth = getAuth();
  const logOut = async () => {
    await signOut(auth);
  };
  return (
    <View className="bg-qasid-black h-full pt-20 text-qasid-gold">
      <Text className="text-qasid-gold"> Home</Text>
      <Pressable onPress={logOut}>
        <Text className="text-qasid-gold">logout</Text>
      </Pressable>
    </View>
  );
}
