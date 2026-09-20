import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { Link } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSegments } from "expo-router";
import { useUserStore } from "../stores/userStore";
import { takePendingShare } from "../utils/pendingShare";

import "../global.css";

export default function Welcome() {
  const { user, isLoading } = useUserStore();

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inTabs = segments[0] === "(tabs)";
    const inVerifyEmail =
      segments[0] === "(auth)" && segments.at(1) === "verify-email";
    // The share landing route resolves the link itself and replaces itself
    // with the destination, so this gate must not redirect out from under it.
    const inShareTarget = segments[0] === "t";

    if (!user) {
      if (inTabs || inVerifyEmail) router.replace("/");
      return;
    }

    if (!user.emailVerified) {
      if (!inVerifyEmail) router.replace("/verify-email");
      return;
    }

    if (inShareTarget) return;

    // A link that arrived while signed out was stashed rather than followed;
    // now that the user is through, send them where they were headed.
    const pendingShare = takePendingShare();
    if (pendingShare) {
      router.replace(pendingShare);
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
