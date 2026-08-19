import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { GOLD } from "../constants/colors";
import type { ResolvedPromo } from "../hooks/usePromo";

interface Props {
  promo: ResolvedPromo;
  /** Tighter spacing for the gate modal, where vertical room is scarce. */
  compact?: boolean;
}

/**
 * Renders the currently active promotion. All copy is authored remotely in
 * `config/paywall`; this component only decides how it looks.
 */
export function PromoBanner({ promo, compact = false }: Props) {
  const showFooter = promo.discountPercent !== null || promo.countdown !== null;

  return (
    <View className="relative mb-5 overflow-hidden rounded-2xl">
      <View className="absolute inset-0 bg-qasid-gold/10" />
      <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />

      <View className={compact ? "px-4 py-3" : "px-4 py-4"}>
        <View className="flex-row items-start">
          {promo.emoji ? (
            <Text className={compact ? "text-xl mr-3" : "text-2xl mr-3"}>
              {promo.emoji}
            </Text>
          ) : null}

          <View className="flex-1">
            {promo.badge ? (
              <Text className="text-qasid-gold text-[11px] font-semibold tracking-wider uppercase mb-1">
                {promo.badge}
              </Text>
            ) : null}

            <Text
              className={`text-white font-semibold ${compact ? "text-base" : "text-lg"}`}
            >
              {promo.title}
            </Text>

            {promo.subtitle ? (
              <Text className="text-white/70 text-sm mt-1 leading-5">
                {promo.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {showFooter ? (
          <View className="flex-row items-center flex-wrap gap-2 mt-3">
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
        ) : null}
      </View>
    </View>
  );
}
