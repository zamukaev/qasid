import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";

import "../global.css";
import { Link } from "expo-router";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import { SafeAreaView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSegments } from "expo-router";

export default function Welcome() {
  const [inizializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>();

  const router = useRouter();
  const segments = useSegments();

  const onAuthStateChanged = (user: FirebaseAuthTypes.User | null) => {
    setUser(user);
    if (inizializing) setInitializing(false);
  };

  useEffect(() => {
    const subscribe = auth().onAuthStateChanged(onAuthStateChanged);
    return subscribe;
  });

  useEffect(() => {
    if (inizializing) return;
    const isAuthGroup = segments[0] === "(tabs)";
    console.log(user);
    if (user && !isAuthGroup) {
      router.replace("(tabs)/home");
    } else if (!user && isAuthGroup) {
      router.replace("/");
    }
  }, [user, inizializing]);

  if (inizializing) {
    return (
      <View className="flex-1 items-center justify-center bg-qasid-black">
        <ActivityIndicator size="large" className="text-qasid-gold" />
      </View>
    );
  }

  if (!inizializing) {
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
}
