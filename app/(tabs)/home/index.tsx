import { Button, Pressable, Text, View } from "react-native";
import auth from "@react-native-firebase/auth";
export default function Quran() {
  return (
    <View>
      <Text> Home</Text>
      <Pressable onPress={auth().signOut}>
        <Text>logout</Text>
      </Pressable>
    </View>
  );
}
