import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useUserStore } from "../../../stores/userStore";

type PlanId = "free" | "monthly" | "yearly" | "family";

const plans: {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  billingNote: string;
  recommended?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Basic access with limited nasheeds and no offline mode.",
    billingNote: "no payment required",
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$3.99",
    period: "month",
    description: "Perfect if you want flexibility month by month.",
    billingNote: "billed every month",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$29.99",
    period: "year",
    description: "Best value for daily listeners who want to save.",
    billingNote: "billed annually",
    recommended: true,
  },
  {
    id: "family",
    name: "Family",
    price: "$59.99",
    period: "year",
    description: "For households with up to 6 QASID accounts.",
    billingNote: "billed annually",
  },
];

const featureComparison: {
  label: string;
  premiumOnly?: boolean;
  free?: boolean;
  premium?: boolean;
  freeText?: string;
  premiumText?: string;
}[] = [
  { label: "Unlimited quran listening", free: true, premium: true },
  { label: "Background playback", free: true, premium: true },
  { label: "Unlimited nasheeds listening", free: false, premium: true },
  { label: "Offline mode", free: false, premium: true },
];

export default function Premium() {
  const currentPlan = useUserStore((state) => state.currentPlan);
  const currentPlanId: PlanId = currentPlan;
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(currentPlanId);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseAnim, selectedPlanId]);

  useEffect(() => {
    setSelectedPlanId(currentPlanId);
  }, [currentPlanId]);

  const selectedCardScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View className="pt-6 pb-3">
            <Text className="text-qasid-white text-3xl font-bold leading-tight">
              Premium
            </Text>
            <Text className="text-white/70 text-base mt-2 leading-6">
              Unlock the full QASID experience. Enjoy unlimited nasheeds,
              offline mode, and more.
            </Text>
          </View>

          <View className="mb-5">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;
              const isSelectedPlan = plan.id === selectedPlanId;

              return (
                <TouchableOpacity
                  key={plan.id}
                  className="mb-4"
                  activeOpacity={0.9}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  <Animated.View
                    className="relative overflow-hidden rounded-2xl"
                    style={
                      isSelectedPlan
                        ? { transform: [{ scale: selectedCardScale }] }
                        : undefined
                    }
                  >
                    <View className="absolute inset-0 bg-qasid-bg-2" />
                    <View
                      className={`absolute inset-0 rounded-2xl border ${
                        isSelectedPlan
                          ? "border-qasid-gold/40"
                          : "border-white/10"
                      }`}
                    />

                    <View className="px-5 py-5">
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                          <View className="flex-row items-center gap-2">
                            <View
                              className={`h-6 w-6 items-center justify-center rounded-full border ${
                                isSelectedPlan
                                  ? "border-[#22c55e] bg-[#22c55e]/20"
                                  : "border-white/30 bg-transparent"
                              }`}
                            >
                              {isSelectedPlan ? (
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color="#22c55e"
                                />
                              ) : null}
                            </View>
                            <Text className="text-white text-xl font-semibold">
                              {plan.name}
                            </Text>
                            {plan.recommended ? (
                              <View className="rounded-full border border-qasid-gold/40 bg-qasid-gold/15 px-2.5 py-1">
                                <Text className="text-qasid-gold text-[11px] font-semibold">
                                  Recommended
                                </Text>
                              </View>
                            ) : null}
                            {isCurrentPlan ? (
                              <View className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
                                <Text className="text-white text-[11px] font-semibold">
                                  Current plan
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-white/60 text-sm mt-2">
                            {plan.description}
                          </Text>
                        </View>
                        <View className="items-end ml-4">
                          <Text className="text-qasid-gold text-lg font-semibold">
                            {plan.price} / {plan.period}
                          </Text>
                          <Text className="text-white/55 text-xs mt-0.5">
                            {plan.billingNote}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="mb-6">
            <Text className="text-white text-lg font-semibold">
              Premium features
            </Text>
            <View className="mt-3 rounded-2xl border border-white/10 bg-qasid-bg-2 px-4 py-4">
              <View className="mb-2 flex-row items-center justify-end">
                <Text className="w-[58px] text-center text-xs font-semibold text-white/50">
                  Free
                </Text>
                <Text className="w-[80px] text-center text-xs font-semibold text-qasid-gold">
                  Premium
                </Text>
              </View>

              {featureComparison.map((item) => (
                <View
                  key={item.label}
                  className="border-t border-white/10 py-3"
                >
                  <View className="flex-row items-center">
                    <View className="mr-2 flex-1">
                      <Text className="text-sm text-white/90">
                        {item.label}
                      </Text>
                    </View>

                    <View className="w-[58px] items-center">
                      {item.freeText ? (
                        <Text
                          className={`text-xs font-semibold ${
                            item.freeText === "Unlimited"
                              ? "text-[#22c55e]"
                              : "text-[#ef4444]"
                          }`}
                        >
                          {item.freeText}
                        </Text>
                      ) : (
                        <Ionicons
                          name={item.free ? "checkmark-circle" : "close-circle"}
                          size={20}
                          color={item.free ? "#22c55e" : "#ef4444"}
                        />
                      )}
                    </View>
                    <View className="w-[80px] items-center">
                      {item.premiumText ? (
                        <Text
                          className={`text-xs font-semibold ${
                            item.premiumText === "Unlimited"
                              ? "text-[#22c55e]"
                              : "text-[#ef4444]"
                          }`}
                        >
                          {item.premiumText}
                        </Text>
                      ) : (
                        <Ionicons
                          name={
                            item.premium ? "checkmark-circle" : "close-circle"
                          }
                          size={20}
                          color={item.premium ? "#22c55e" : "#ef4444"}
                        />
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity className="mt-120" activeOpacity={0.8}>
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-gold/10" />
              <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />

              <View className="px-4 py-4 items-center">
                <Text className="text-qasid-gold text-base font-semibold">
                  Upgrade to Premium →
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View className="mt-3 mb-14">
            <Text className="text-white/50 text-sm text-center">
              Cancel anytime. Secure payment. Keep your listening uninterrupted.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
