import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { getAuth } from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import { ScreenLayout } from "../../../components";
import { useUserStore } from "../../../stores/userStore";

export default function Settings() {
  const { user, clearUser } = useUserStore();
  const router = useRouter();
  const auth = getAuth();
  const appVersion = Constants.expoConfig?.version ?? "unknown";

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await auth.signOut();
            clearUser();
            router.replace("/");
          } catch (error) {
            console.error("Error signing out:", error);
          }
        },
      },
    ]);
  };

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@qasid.app");
  };

  const handleTermsPrivacy = () => {
    Linking.openURL("https://qasid.app/terms");
  };

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5">
        {/* Header */}
        <View className="pt-6 pb-6">
          <Text className="text-qasid-gold text-3xl font-bold">Settings</Text>
          <Text className="text-white/60 text-base mt-2">
            Personalize your QASID experience
          </Text>
        </View>

        {/* User Profile with Avatar */}
        <View className="flex-row items-center mb-8">
          {/* Avatar */}
          <View className="w-16 h-16 rounded-full bg-qasid-gold/20 items-center justify-center border-2 border-qasid-gold/30">
            <Text className="text-qasid-gold text-2xl font-bold">
              {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </View>

          {/* User Info */}
          <View className="ml-4 flex-1">
            <Text className="text-white text-xl font-semibold">
              {user?.displayName || "User"}
            </Text>
            <Text className="text-white/60 text-sm mt-0.5">
              {user?.email || "No email"}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Account
          </Text>

          <TouchableOpacity activeOpacity={0.7}>
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <LinearGradient
                colors={["rgba(231,193,28,0.05)", "rgba(0,0,0,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: "absolute", inset: 0 }}
              />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />

              <View className="px-4 py-4 flex-row items-center justify-between">
                <Text className="text-white text-base">Profile Settings</Text>
                <Text className="text-white/40 text-base">→</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Subscription Section */}
        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Subscription
          </Text>

          <View className="relative overflow-hidden rounded-2xl">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <LinearGradient
              colors={[
                "rgba(231,193,28,0.08)",
                "rgba(231,193,28,0.02)",
                "rgba(0,0,0,0.00)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", inset: 0 }}
            />
            <View className="absolute inset-0 rounded-2xl border border-white/10" />

            <View className="px-4 py-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-white text-base font-semibold">
                    Free Plan
                  </Text>
                  <Text className="text-white/50 text-sm mt-0.5">
                    Basic features included
                  </Text>
                </View>
                <View className="px-3 py-1 rounded-full bg-qasid-gold/20">
                  <Text className="text-qasid-gold text-xs font-semibold">
                    Current
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Support & Legal Section */}
        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Support & Legal
          </Text>

          {/* Contact Support */}
          <TouchableOpacity
            onPress={handleContactSupport}
            activeOpacity={0.7}
            className="mb-3"
          >
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <LinearGradient
                colors={["rgba(231,193,28,0.05)", "rgba(0,0,0,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: "absolute", inset: 0 }}
              />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />

              <View className="px-4 py-4 flex-row items-center justify-between">
                <Text className="text-white text-base">Contact Support</Text>
                <Text className="text-white/40 text-base">→</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Terms & Privacy */}
          <TouchableOpacity onPress={handleTermsPrivacy} activeOpacity={0.7}>
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <LinearGradient
                colors={["rgba(231,193,28,0.05)", "rgba(0,0,0,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: "absolute", inset: 0 }}
              />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />

              <View className="px-4 py-4 flex-row items-center justify-between">
                <Text className="text-white text-base">Terms & Privacy</Text>
                <Text className="text-white/40 text-base">→</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            About
          </Text>

          <View className="relative overflow-hidden rounded-2xl">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <LinearGradient
              colors={["rgba(231,193,28,0.05)", "rgba(0,0,0,0.00)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: "absolute", inset: 0 }}
            />
            <View className="absolute inset-0 rounded-2xl border border-white/10" />

            <View className="px-4 py-4">
              <Text className="text-white text-base font-semibold mb-1">
                QASID
              </Text>
              <Text className="text-white/50 text-sm">Version {appVersion}</Text>
            </View>
          </View>
        </View>

        {/* Log Out Button */}
        <View className="mb-8">
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}>
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-red-600/10" />
              <View className="absolute inset-0 rounded-2xl border border-red-500/30" />

              <View className="px-4 py-4 items-center">
                <Text className="text-red-500 text-base font-semibold">
                  Log Out
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
