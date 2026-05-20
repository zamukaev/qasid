import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";

import {
  getAuth,
  signInWithEmailAndPassword,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { Stack } from "expo-router";

import { ErrorAlert } from "../../../components";

import { getFirebaseErrorMessage } from "../../../utils/firebaseErrors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailSignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);
  const auth = getAuth();

  const validateEmail = (value: string) => {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_REGEX.test(value)) return "Enter a valid email address";
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    return "";
  };

  const validate = () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    return !eErr && !pErr;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
      <Stack.Screen options={{ headerTitle: "Sign in" }} />
      <Text className="text-qasid-gold text-2xl mb-5">Sign in</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (emailError) setEmailError(validateEmail(v));
        }}
        onBlur={() => setEmailError(validateEmail(email))}
        className={`bg-qasid-gray text-qasid-white p-4 rounded-lg ${emailError ? "border border-red-500" : ""}`}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {emailError ? (
        <Text className="text-red-500 text-sm mb-2 mt-1">{emailError}</Text>
      ) : (
        <View className="mb-2" />
      )}

      <TextInput
        placeholder="Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (passwordError) setPasswordError(validatePassword(v));
        }}
        onBlur={() => setPasswordError(validatePassword(password))}
        className={`bg-qasid-gray text-qasid-white p-4 rounded-lg ${passwordError ? "border border-red-500" : ""}`}
      />
      {passwordError ? (
        <Text className="text-red-500 text-sm mb-6 mt-1">{passwordError}</Text>
      ) : (
        <View className="mb-8" />
      )}

      <TouchableOpacity
        onPress={handleSignIn}
        disabled={loading}
        className="w-full items-center rounded-2xl bg-qasid-gold px-6 py-4"
        activeOpacity={0.8}
      >
        <Text className="text-qasid-black font-semibold text-lg">
          {loading ? "Signing in..." : "Sign in"}
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
