// app/(tabs)/_layout.tsx
import { Redirect, Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
} from "@react-native-firebase/auth";
import { NowPlayingBar, FullScreenPlayer } from "../../components";
import { useAudioPlayer } from "../../context/AudioPlayerContext";

export default function TabsLayout() {
  const [auth, setAuth] = useState(true);
  const router = useRouter();
  const { viewMode } = useAudioPlayer();

  const handleAuthStateChanged = (user: FirebaseAuthTypes.User | null) => {
    if (!user) {
      router.replace("/");
    }
  };

  useEffect(() => {
    const subscribe = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscribe;
  });

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            paddingTop: 10,
            backgroundColor: "#1c1c1c",
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
      >
        <Tabs.Screen
          name="home/index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
            tabBarActiveTintColor: "#E7C11C",
          }}
        />
        <Tabs.Screen
          name="quran/index"
          options={{
            title: "Коран",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" color={color} size={size} />
            ),
            tabBarActiveTintColor: "#E7C11C",
          }}
        />
        <Tabs.Screen
          name="nasheeds/index"
          options={{
            title: "Нашиды",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="musical-notes-outline"
                color={color}
                size={size}
              />
            ),
            tabBarActiveTintColor: "#E7C11C",
          }}
        />

        <Tabs.Screen
          name="settings/index"
          options={{
            title: "Настройки",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" color={color} size={size} />
            ),
            tabBarActiveTintColor: "#E7C11C",
          }}
        />
      </Tabs>
      {viewMode !== "hidden" && <NowPlayingBar />}
      {viewMode === "full" && <FullScreenPlayer />}
    </>
  );
}
