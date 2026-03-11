import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";

// вынеси в .env потом
const CONTACT_EMAIL = "hello@qasid.mock";
const TELEGRAM_HANDLE = "@qasid_support_mock";
const TELEGRAM_URL = "https://t.me/qasid_support_mock";

export default function ContactSupportScreen() {
  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  };

  const openTelegram = () => {
    Linking.openURL(TELEGRAM_URL);
  };

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5">
        <View className="pt-6 mb-6">
          <Text className="text-white/60 text-base">
            Company contacts and support channels
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Contacts
          </Text>

          <TouchableOpacity
            onPress={openEmail}
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
                <View className="flex-1">
                  <Text className="text-white text-base">Email</Text>
                  <Text className="text-white/50 text-sm mt-0.5">
                    {CONTACT_EMAIL}
                  </Text>
                </View>
                <Text className="text-white/40 text-base">→</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={openTelegram} activeOpacity={0.7}>
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
                <View className="flex-1">
                  <Text className="text-white text-base">Telegram</Text>
                  <Text className="text-white/50 text-sm mt-0.5">
                    {TELEGRAM_HANDLE}
                  </Text>
                </View>
                <Text className="text-white/40 text-base">→</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
