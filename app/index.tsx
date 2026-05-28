import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
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
import * as RevenueCatService from "../services/revenuecat";
import "../global.css";

export default function Welcome() {
  const { user, isLoading, setUser, setLoading } = useUserStore();

  const router = useRouter();
  const segments = useSegments();

  const handleAuthStateChanged = async (
    firebaseUser: FirebaseAuthTypes.User | null,
  ) => {
    setUser(firebaseUser);
    if (firebaseUser) {
      try {
        await RevenueCatService.initialize(firebaseUser.uid);
      } catch {
        // RC initialization failure should not block the auth flow
      }
    } else {
      await RevenueCatService.logout();
    }
  };

  useEffect(() => {
    setLoading(true);
    const subscribe = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscribe;
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inTabs = segments[0] === "(tabs)";
    const inVerifyEmail =
      segments[0] === "(auth)" && segments[1] === "verify-email";

    if (!user) {
      if (inTabs || inVerifyEmail) router.replace("/");
      return;
    }

    if (!user.emailVerified) {
      if (!inVerifyEmail) router.replace("/verify-email");
      return;
    }

    if (!inTabs) {
      router.replace("(tabs)/quran");
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
      </View>
    </SafeAreaView>
  );
}
