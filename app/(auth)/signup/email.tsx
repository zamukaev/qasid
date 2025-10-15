import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";

import {
  getAuth,
  createUserWithEmailAndPassword,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { Stack } from "expo-router";

import { ErrorAlert } from "../../../components";
import { getFirebaseErrorMessage } from "../../../utils/firebaseErrors";

export default function EmailSignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const user = await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      const err = e as FirebaseAuthTypes.NativeFirebaseAuthError;
      const errorMessage = getFirebaseErrorMessage(err.code);
      setError(errorMessage);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className=" flex-1 bg-qasid-black justify-center px-5">
      <Stack.Screen options={{ headerTitle: "Create account" }} />
      <Text className="text-qasid-gold text-2xl mb-5">Create Account</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        className="bg-qasid-gray text-qasid-white p-4 rounded-lg mb-2"
        keyboardType="email-address"
        autoCapitalize="none"
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
        onPress={handleSignUp}
        disabled={loading}
        className="bg-qasid-gold p-4 rounded-lg items-center"
      >
        <Text className="text-qasid-black font-bold">
          {loading ? "Creating account..." : "Sign up"}
        </Text>
      </TouchableOpacity>

      <ErrorAlert
        visible={showError}
        message={error}
        type="error"
        onClose={() => setShowError(false)}
      />
    </View>
  );
}
