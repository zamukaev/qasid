import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";

import {
  getAuth,
  signInWithEmailAndPassword,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { Stack } from "expo-router";

export default function EmailSignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      const err = e as FirebaseAuthTypes.NativeFirebaseAuthError;

      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className=" flex-1 bg-qasid-black justify-center px-5">
      <Stack.Screen options={{ headerTitle: "Sign in" }} />
      <Text className="text-qasid-gold text-2xl mb-5">Sign in</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        className="bg-qasid-gray text-qasid-white p-4 rounded-lg mb-2"
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        className="bg-qasid-gray text-qasid-white p-4 rounded-lg mb-8"
      />

      <TouchableOpacity
        onPress={handleSignIn}
        disabled={loading}
        className="bg-qasid-gold p-4 rounded-lg items-center"
      >
        <Text className="text-qasid-black font-bold">Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
