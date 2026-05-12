import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
} from "@react-native-firebase/auth";
import { NowPlayingBar, FullScreenPlayer } from "../../components";
import { useAudioPlayer } from "../../context/AudioPlayerContext";

function AnimatedTabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.1 : 1)).current;
  const translateY = useRef(new Animated.Value(focused ? -2 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.1 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();

    Animated.spring(translateY, {
      toValue: focused ? -2 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [focused, scale, translateY]);

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
      <Ionicons name={name} color={color} size={size} />
    </Animated.View>
  );
}

export default function TabsLayout() {
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
  }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: 74,
            paddingTop: 8,
            paddingBottom: 10,
            paddingHorizontal: 10,
            backgroundColor: "rgba(11, 11, 12, 0.88)",
            borderTopWidth: 1,
            borderTopColor: "rgba(231, 193, 28, 0.12)",
            elevation: 10,
            shadowColor: "#000000",
            shadowOpacity: 0.22,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -5 },
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.6,
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingTop: 4,
            borderRadius: 18,
          },
          tabBarActiveTintColor: "#E7C11C",
          tabBarInactiveTintColor: "rgba(255, 255, 255, 0.58)",
          tabBarBackground: () => (
            <LinearGradient
              colors={[
                "rgba(20, 20, 22, 0.92)",
                "rgba(11, 11, 12, 0.96)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1 }}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="quran"
          options={{
            title: "Quran",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name="book-outline"
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="nasheeds"
          options={{
            title: "Nasheeds",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name="musical-notes-outline"
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabIcon
                name="settings-outline"
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
      {viewMode !== "hidden" && <NowPlayingBar />}
      {viewMode === "full" && <FullScreenPlayer />}
    </>
  );
}
