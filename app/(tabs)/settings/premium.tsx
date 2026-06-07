import { Ionicons } from "@expo/vector-icons";
import { GOLD } from "../../../constants/colors";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PURCHASES_ERROR_CODE } from "react-native-purchases";
import { useRevenueCat } from "../../../hooks/useRevenueCat";
import { useUserStore } from "../../../stores/userStore";

type PlanId = "free" | "monthly" | "yearly";

const PLAN_META: Record<
  Exclude<PlanId, "free">,
  {
    name: string;
    period: string;
    description: string;
    billingNote: string;
    recommended?: boolean;
  }
> = {
  monthly: {
    name: "Monthly",
    period: "month",
    description: "Perfect if you want flexibility month by month.",
    billingNote: "billed every month",
  },
  yearly: {
    name: "Yearly",
    period: "year",
    description: "Best value for daily listeners who want to save.",
    billingNote: "billed annually",
    recommended: true,
  },
};

const featureComparison: {
  label: string;
  free: boolean;
  premium: boolean;
}[] = [
  { label: "Unlimited quran listening", free: true, premium: true },
  { label: "Background playback", free: false, premium: true },
  { label: "Unlimited nasheeds listening", free: false, premium: true },
  { label: "Offline mode", free: false, premium: true },
];

export default function Premium() {
  const router = useRouter();
  const currentPlan = useUserStore((state) => state.currentPlan);
  const currentPlanId: PlanId =
    currentPlan === "monthly" || currentPlan === "yearly"
      ? currentPlan
      : "free";

  const {
    offerings,
    isPremium,
    isLoading: rcLoading,
    purchasePackage,
    restorePurchases,
  } = useRevenueCat();

  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(currentPlanId);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
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

  const monthlyPkg =
    offerings?.availablePackages.find((p) => p.identifier === "$rc_monthly") ??
    null;
  const yearlyPkg =
    offerings?.availablePackages.find((p) => p.identifier === "$rc_annual") ??
    null;

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
      id: "monthly" as PlanId,
      price: rcLoading ? "—" : (monthlyPkg?.product.priceString ?? "$3.99"),
      ...PLAN_META.monthly,
    },
    {
      id: "yearly" as PlanId,
      price: rcLoading ? "—" : (yearlyPkg?.product.priceString ?? "$29.99"),
      ...PLAN_META.yearly,
    },
  ];

  const selectedCardScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const handleUpgrade = async () => {
    const pkg =
      selectedPlanId === "monthly"
        ? monthlyPkg
        : selectedPlanId === "yearly"
          ? yearlyPkg
          : null;

    if (!pkg) return;

    setIsPurchasing(true);
    try {
      await purchasePackage(pkg);
    } catch (error: any) {
      if (
        !error?.userCancelled &&
        error?.code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
      ) {
        Alert.alert(
          "Purchase Failed",
          error?.message ?? "Something went wrong. Please try again.",
        );
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      await restorePurchases();
      Alert.alert("Success", "Your purchases have been restored.");
    } catch (error: any) {
      Alert.alert(
        "Restore Failed",
        error?.message ?? "Could not restore purchases. Please try again.",
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const isCurrentPlan = selectedPlanId === currentPlanId;
  const isFree = selectedPlanId === "free";
  const ctaDisabled = isFree || isCurrentPlan || isPurchasing || rcLoading;

  const ctaLabel = isPurchasing
    ? "Processing..."
    : isCurrentPlan && isPremium
      ? "Active Plan"
      : isFree
        ? "Continue with Free"
        : "Upgrade to Premium →";

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
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
              const isCurrentPlanCard = plan.id === currentPlanId;
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
                          <View className="flex-row items-center gap-2 flex-wrap">
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
                            {isCurrentPlanCard ? (
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
                          {rcLoading && plan.id !== "free" ? (
                            <ActivityIndicator size="small" color={GOLD} />
                          ) : (
                            <Text className="text-qasid-gold text-lg font-semibold">
                              {plan.price} / {plan.period}
                            </Text>
                          )}
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
                      <Ionicons
                        name={item.free ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={item.free ? "#22c55e" : "#ef4444"}
                      />
                    </View>
                    <View className="w-[80px] items-center">
                      <Ionicons
                        name={
                          item.premium ? "checkmark-circle" : "close-circle"
                        }
                        size={20}
                        color={item.premium ? "#22c55e" : "#ef4444"}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            className="mt-2"
            activeOpacity={ctaDisabled ? 1 : 0.8}
            onPress={ctaDisabled ? undefined : handleUpgrade}
            disabled={ctaDisabled}
          >
            <View className="relative overflow-hidden rounded-2xl">
              <View
                className={`absolute inset-0 ${ctaDisabled ? "bg-white/5" : "bg-qasid-gold/10"}`}
              />
              <View
                className={`absolute inset-0 rounded-2xl border ${ctaDisabled ? "border-white/10" : "border-qasid-gold/30"}`}
              />
              <View className="px-4 py-4 items-center">
                {isPurchasing ? (
                  <ActivityIndicator size="small" color={GOLD} />
                ) : (
                  <Text
                    className={`text-base font-semibold ${ctaDisabled ? "text-white/30" : "text-qasid-gold"}`}
                  >
                    {ctaLabel}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3"
            activeOpacity={0.7}
            onPress={isPurchasing ? undefined : handleRestore}
            disabled={isPurchasing}
          >
            <View className="px-4 py-3 items-center">
              <Text className="text-white/40 text-sm">Restore Purchases</Text>
            </View>
          </TouchableOpacity>

          <View className="mb-14">
            <Text className="text-white/50 text-sm text-center">
              Cancel anytime. Secure payment. Keep your listening uninterrupted.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
