import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { Link } from "expo-router";
import { useState } from "react";
import { SafeAreaView, Image, Pressable } from "react-native";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { useUserStore } from "../stores/userStore";
import { continueAsGuest } from "../services/auth-service";
import { ErrorAlert } from "../components";
import { getFirebaseErrorMessage } from "../utils/firebaseErrors";

import "../global.css";

// Auth listening (hooks/useAuthBootstrap.ts) and redirects (hooks/useAuthGate.ts)
// live in the root layout; this is only the fallback welcome UI.
export default function Welcome() {
  const isLoading = useUserStore((s) => s.isLoading);
  const [startingGuest, setStartingGuest] = useState(false);
  const [error, setError] = useState("");

  const handleContinueAsGuest = async () => {
    setStartingGuest(true);
    try {
      await continueAsGuest();
    } catch (e) {
      const err = e as FirebaseAuthTypes.NativeFirebaseAuthError;
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setStartingGuest(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-qasid-black">
        <ActivityIndicator size="large" className="text-qasid-gold" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require("../assets/logo.png")}
          className="w-80 h-80 mb-[-40px]"
        />
        <Text className="text-white/80 text-xl text-center mb-10">
          Sacred sounds. Pure soul.
        </Text>
        <Link href="/signup" asChild>
          <Pressable
            className="w-full rounded-xl bg-qasid-gold py-4 mb-3"
            android_ripple={{ color: "#745c25" }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text className="text-qasid-black text-center text-lg font-semibold">
              Sign up for free
            </Text>
          </Pressable>
        </Link>
        <Link href="/signin" asChild>
          <Pressable
            className="w-full rounded-xl border-2 border-qasid-gray py-4"
            android_ripple={{ color: "#a88d47" }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text className="text-qasid-white text-center text-lg font-semibold">
              Sign in
            </Text>
          </Pressable>
        </Link>
        <Pressable
          onPress={handleContinueAsGuest}
          disabled={startingGuest}
          className="w-full py-4 mt-2"
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          {startingGuest ? (
            <ActivityIndicator className="text-qasid-gold" />
          ) : (
            <Text className="text-white/70 text-center text-base font-semibold">
              Continue as guest
            </Text>
          )}
        </Pressable>
      </View>
      <ErrorAlert
        visible={error !== ""}
        message={error}
        onClose={() => setError("")}
      />
    </SafeAreaView>
  );
}
