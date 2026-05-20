import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";

const TERMS_URL = "https://qasid-sound.com/terms.html";
const PRIVACY_URL = "https://qasid-sound.com/privacy.html";

export default function TermsPrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5">
        <View className="pt-6 mb-6">
          <Text className="text-white/60 text-base">
            Legal documents for QASID
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Legal
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL(TERMS_URL)}
            activeOpacity={0.7}
            className="mb-3"
          >
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <LinearGradient
                colors={["rgba(201,168,76,0.05)", "rgba(0,0,0,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: "absolute", inset: 0 }}
              />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />

              <View className="px-4 py-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white text-base">Terms of Service</Text>
                </View>
                <Text className="text-white/40 text-base">→</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_URL)}
            activeOpacity={0.7}
          >
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <LinearGradient
                colors={["rgba(201,168,76,0.05)", "rgba(0,0,0,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: "absolute", inset: 0 }}
              />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />

              <View className="px-4 py-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white text-base">Privacy Policy</Text>
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
