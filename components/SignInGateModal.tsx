import { Ionicons } from "@expo/vector-icons";
import { GOLD } from "../constants/colors";
import { useRouter } from "expo-router";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useSignInGateStore } from "../stores/signInGateStore";

export function SignInGateModal() {
  const router = useRouter();
  const feature = useSignInGateStore((s) => s.feature);
  const close = useSignInGateStore((s) => s.close);

  const goTo = (route: "/signup" | "/signin") => {
    close();
    router.push(route);
  };

  return (
    <Modal
      visible={feature !== null}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/70 px-6"
        onPress={close}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm"
        >
          <View className="relative overflow-hidden rounded-3xl">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <View className="absolute inset-0 rounded-3xl border border-qasid-gold/30" />

            <View className="p-6">
              <View className="items-center mb-5">
                <View className="w-14 h-14 rounded-full bg-qasid-gold/15 border border-qasid-gold/30 items-center justify-center mb-4">
                  <Ionicons
                    name="person-circle-outline"
                    size={26}
                    color={GOLD}
                  />
                </View>
                <Text className="text-white text-xl font-bold text-center">
                  Create a free account
                </Text>
                <Text className="text-white/60 text-sm text-center mt-2 leading-5">
                  Sign in to {feature ?? "use this feature"}. It's free and
                  keeps your library in sync across devices.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => goTo("/signup")}
              >
                <View className="rounded-2xl bg-qasid-gold py-4 items-center">
                  <Text className="text-qasid-black text-base font-semibold">
                    Sign up for free
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => goTo("/signin")}
                className="mt-3"
              >
                <View className="relative overflow-hidden rounded-2xl">
                  <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />
                  <View className="py-4 items-center">
                    <Text className="text-qasid-gold text-base font-semibold">
                      I already have an account
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} onPress={close}>
                <View className="py-3 items-center">
                  <Text className="text-white/40 text-sm">Maybe later</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
