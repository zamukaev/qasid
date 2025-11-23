import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";

import "../global.css";
import { Link } from "expo-router";
import {
  getAuth,
  FirebaseAuthTypes,
  onAuthStateChanged,
} from "@react-native-firebase/auth";
import { useEffect } from "react";
import { SafeAreaView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSegments } from "expo-router";
import { useUserStore } from "../stores/userStore";

export default function Welcome() {
  const { user, isLoading, isAuthenticated, setUser, setLoading } =
    useUserStore();

  const router = useRouter();
  const segments = useSegments();

  const handleAuthStateChanged = (
    firebaseUser: FirebaseAuthTypes.User | null
  ) => {
    setUser(firebaseUser);
  };

  useEffect(() => {
    setLoading(true);
    const subscribe = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscribe;
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const isAuthGroup = segments[0] === "(tabs)";
    console.log(
      "User auth state:",
      user ? "authenticated" : "not authenticated"
    );
    if (user && !isAuthGroup) {
      router.replace("(tabs)/quran");
    } else if (!user && isAuthGroup) {
      router.replace("/");
    }
  }, [user, isLoading]);

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
          resizeMode="contain"
          className="w-36 h-36 mb-6"
        />

        {/* Заголовок */}
        <Text className="text-qasid-title text-6xl font-display tracking-[4] mb-2">
          QASID
        </Text>

        {/* Подзаголовок */}
        <Text className="text-white/80 text-xl text-center mb-10">
          Sacred sounds. Pure soul.
        </Text>

        {/* CTA: Sign Up */}
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
      </View>
    </SafeAreaView>
  );
}
