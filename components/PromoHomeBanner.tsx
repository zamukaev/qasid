import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { GOLD, GOLD_RIPPLE } from "../constants/colors";
import { usePromo } from "../hooks/usePromo";
import { logPromoBanner } from "../services/analytics";
import { usePaywallStore } from "../stores/paywallStore";
import { useIsPremium, useUserStore } from "../stores/userStore";
import type { PromoIconName } from "../types/paywall";

const DEFAULT_CTA = "Get the offer";
const DEFAULT_ICON: PromoIconName = "sparkles";
// The CTA arrow is drawn, so a trailing arrow in remote copy would double up.
const TRAILING_ARROW = /\s*[→›»>]+$/;
const ENTER_DURATION_MS = 420;
const EXIT_DURATION_MS = 160;
const ENTER_OFFSET = 12;
const CLOSE_HIT_SLOP = 12;

// One impression per promo per app session — the banner sits on two screens a
// user switches between all the time, and every switch would otherwise log.
const _seen = new Set<string>();

/**
 * Home-screen banner for the currently running promotion. Copy, timing and
 * placement all come from `config/paywall` (see `docs/paywall-config.md`); this
 * component only decides whether and how it is shown.
 */
export function PromoHomeBanner() {
  const router = useRouter();
  const isPremium = useIsPremium();
  const planResolved = useUserStore((state) => state.planResolved);
  const dismissedPromoIds = usePaywallStore((state) => state.dismissedPromoIds);
  const dismissPromo = usePaywallStore((state) => state.dismissPromo);
  const { promo } = usePromo();

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(ENTER_OFFSET)).current;

  // Premium users never see an upgrade pitch, and an unresolved plan is
  // treated as premium here: better no banner for a moment than advertising to
  // someone who already pays.
  const visible =
    planResolved &&
    !isPremium &&
    promo !== null &&
    promo.showOnHome &&
    !dismissedPromoIds.includes(promo.id);

  const promoId = visible && promo ? promo.id : null;

  useEffect(() => {
    if (promoId === null) return;

    if (!_seen.has(promoId)) {
      _seen.add(promoId);
      void logPromoBanner("view", promoId);
    }

    opacity.setValue(0);
    translateY.setValue(ENTER_OFFSET);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [promoId, opacity, translateY]);

  if (!visible || !promo) return null;

  const handleOpen = () => {
    void logPromoBanner("tap", promo.id);
    // The premium screen preselects `highlightPlan` on its own.
    router.push("/settings/premium");
  };

  const handleDismiss = () => {
    void logPromoBanner("dismiss", promo.id);
    // Fading out first, then dropping it from the store, keeps the card from
    // vanishing mid-frame. No LayoutAnimation: the New Architecture is on.
    Animated.timing(opacity, {
      toValue: 0,
      duration: EXIT_DURATION_MS,
      useNativeDriver: true,
    }).start(() => dismissPromo(promo.id));
  };

  const showChips = promo.discountPercent !== null || promo.countdown !== null;
  // An emoji still wins when one is authored, so existing promos keep their look.
  const icon: PromoIconName | null = promo.emoji
    ? null
    : (promo.icon ?? DEFAULT_ICON);
  const ctaLabel = (promo.ctaLabel ?? DEFAULT_CTA).replace(TRAILING_ARROW, "");

  return (
    // The animated styles stay on their own node: NativeWind writes `className`
    // into the same `style` prop the animation drives.
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View className="px-4 pt-6 pb-1">
        <Pressable
          onPress={handleOpen}
          android_ripple={{ color: GOLD_RIPPLE }}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.94 : 1,
              transform: [{ scale: pressed ? 0.992 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${promo.title}. ${ctaLabel}`}
        >
          <View className="relative overflow-hidden rounded-3xl border border-qasid-gold/30 bg-qasid-bg-2">
            <LinearGradient
              colors={[
                "rgba(201,168,76,0.30)",
                "rgba(201,168,76,0.10)",
                "rgba(0,0,0,0.0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", inset: 0 }}
            />

            <View className="px-5 py-5">
              <View className="flex-row items-start">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-qasid-gold/25 bg-qasid-black/40">
                  {icon ? (
                    <Ionicons name={icon} size={20} color={GOLD} />
                  ) : (
                    <Text className="text-xl">{promo.emoji}</Text>
                  )}
                </View>

                <View className="flex-1 pr-8">
                  {promo.badge ? (
                    <Text className="text-qasid-gold text-[10px] font-semibold uppercase tracking-[2px] mb-1">
                      {promo.badge}
                    </Text>
                  ) : null}

                  <Text className="text-qasid-white text-[22px] leading-7 font-bold tracking-tight">
                    {promo.title}
                  </Text>

                  {promo.subtitle ? (
                    <Text className="mt-1.5 text-white/60 text-[14px] leading-5">
                      {promo.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="mt-4 flex-row items-center justify-between">
                <View className="flex-row items-center flex-wrap gap-2">
                  {promo.discountPercent !== null ? (
                    <View className="rounded-full border border-qasid-gold/40 bg-qasid-gold/15 px-2.5 py-1">
                      <Text className="text-qasid-gold text-[11px] font-semibold">
                        -{promo.discountPercent}%
                      </Text>
                    </View>
                  ) : null}

                  {promo.countdown ? (
                    <View className="flex-row items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
                      <Ionicons name="time-outline" size={12} color={GOLD} />
                      <Text className="text-white/80 text-[11px] font-semibold ml-1">
                        {promo.countdown}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View
                  className={`flex-row items-center ${showChips ? "ml-3" : ""}`}
                >
                  <Text className="text-qasid-gold text-[13px] font-semibold">
                    {ctaLabel}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={GOLD}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleDismiss}
              hitSlop={CLOSE_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Dismiss offer"
              className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-qasid-black/40"
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}
