import { Ionicons } from "@expo/vector-icons";
import { GOLD } from "../constants/colors";
import { useRouter } from "expo-router";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { usePromo } from "../hooks/usePromo";
import { PromoBanner } from "./PromoBanner";

interface Props {
  visible: boolean;
  playsLeft: number;
  onClose: () => void;
}

const DEFAULT_TITLE = "Daily Limit Reached";
const DEFAULT_CTA = "Upgrade to Premium →";

export function PremiumGateModal({ visible, playsLeft, onClose }: Props) {
  const router = useRouter();
  const { promo, freeDailyLimit } = usePromo({ playsLeft });

  const handleUpgrade = () => {
    onClose();
    router.push("/settings/premium");
  };

  const title = promo?.gateTitle ?? DEFAULT_TITLE;
  const body =
    promo?.gateBody ??
    `Free users can listen to ${freeDailyLimit} nasheeds per day. Upgrade to Premium for unlimited access.`;
  const ctaLabel = promo?.ctaLabel ?? DEFAULT_CTA;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/70 px-6"
        onPress={onClose}
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
                  <Ionicons name="lock-closed" size={24} color={GOLD} />
                </View>
                <Text className="text-white text-xl font-bold text-center">
                  {title}
                </Text>
                <Text className="text-white/60 text-sm text-center mt-2 leading-5">
                  {body}
                </Text>
              </View>

              {promo && promo.showOnGate ? (
                <PromoBanner promo={promo} compact />
              ) : null}

              <TouchableOpacity activeOpacity={0.8} onPress={handleUpgrade}>
                <View className="relative overflow-hidden rounded-2xl">
                  <View className="absolute inset-0 bg-qasid-gold/10" />
                  <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />
                  <View className="py-4 items-center">
                    <Text className="text-qasid-gold text-base font-semibold">
                      {ctaLabel}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} onPress={onClose}>
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
