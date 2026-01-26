import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

export type NasheedMood =
  | "calm"
  | "emotional"
  | "beautiful"
  | "powerful"
  | "kids";

type HeroVariant = {
  title: string;
  subtitle: string;
  // Tailwind классы для фона и обводки (QASID gold/black vibe)
  bgClass: string;
  borderClass: string;
  // Дополнительный акцент (подложка/свечение)
  glowClass: string;
};

const VARIANTS: Record<NasheedMood, HeroVariant> = {
  calm: {
    title: "Calm Nasheeds",
    subtitle: "Slow down. Breathe. Listen.",
    bgClass: "bg-[#0B0B0D]",
    borderClass: "border-[#2A2413]",
    glowClass: "bg-[#E7C11C]/10",
  },
  emotional: {
    title: "Emotional Nasheeds",
    subtitle: "For the heart and the soul.",
    bgClass: "bg-[#0B0B0D]",
    borderClass: "border-[#3A2F12]",
    glowClass: "bg-[#E7C11C]/14",
  },
  beautiful: {
    title: "Beautiful Nasheeds",
    subtitle: "Feel the peace.",
    bgClass: "bg-[#0B0B0D]",
    borderClass: "border-[#E7C11C]/35",
    glowClass: "bg-[#E7C11C]/18",
  },
  powerful: {
    title: "Powerful Nasheeds",
    subtitle: "Strength in every word.",
    bgClass: "bg-[#0B0B0D]",
    borderClass: "border-[#E7C11C]/40",
    glowClass: "bg-[#E7C11C]/16",
  },
  kids: {
    title: "For Kids",
    subtitle: "Simple, kind, uplifting.",
    bgClass: "bg-[#0B0B0D]",
    borderClass: "border-[#E7C11C]/28",
    glowClass: "bg-[#E7C11C]/12",
  },
};

type Props = {
  mood: NasheedMood;
  onPlayAll?: () => void;
  rightSlot?: React.ReactNode; // например иконка поиска
  className?: string; // если хочешь дополнительно управлять внешними отступами
};

export function NasheedsHero({
  mood,
  onPlayAll,
  rightSlot,
  className = "",
}: Props) {
  const variant = useMemo(() => VARIANTS[mood], [mood]);

  // Мягкая смена контента: fade-out -> смена текста -> fade-in
  const opacity = useRef(new Animated.Value(1)).current;
  const [renderVariant, setRenderVariant] = useState(variant);

  useEffect(() => {
    // если mood не менялся — ничего не делаем
    if (renderVariant === variant) return;

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // Сменим контент между фазами (через микро-таймаут)
    const t = setTimeout(() => setRenderVariant(variant), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  return (
    <View className={`px-4 pt-4 ${className}`}>
      <View
        className={[
          "rounded-3xl border overflow-hidden",
          renderVariant.bgClass,
          renderVariant.borderClass,
        ].join(" ")}
      >
        {/* Glow / texture layer */}
        <View className="absolute -top-24 -right-24 h-60 w-60 rounded-full bg-[#E7C11C]/10" />
        <View
          className={`absolute -bottom-28 -left-28 h-72 w-72 rounded-full ${renderVariant.glowClass}`}
        />
        <View className="absolute top-0 left-0 right-0 h-24 bg-white/5" />

        {/* Header row */}
        <View className="flex-row items-center justify-between px-5 pt-5">
          <View className="h-9 w-9 rounded-xl border border-[#E7C11C]/25 bg-black/35 items-center justify-center">
            <Text className="text-[#E7C11C] text-xs">Q</Text>
          </View>

          <View className="flex-row items-center gap-3">{rightSlot}</View>
        </View>

        {/* Content */}
        <Animated.View style={{ opacity }} className="px-5 pt-5 pb-6">
          <Text className="text-[#E7C11C] text-2xl font-semibold tracking-wide">
            {renderVariant.title}
          </Text>
          <Text className="text-white/75 mt-1">{renderVariant.subtitle}</Text>

          {/* CTA */}
          <Pressable
            onPress={onPlayAll}
            className="mt-5 h-12 rounded-2xl border border-[#E7C11C]/35 bg-black/45 items-center justify-center flex-row gap-2"
          >
            <Text className="text-[#E7C11C] text-base font-semibold">▶</Text>
            <Text className="text-white text-base font-semibold">Play All</Text>
          </Pressable>

          {/* Mood chips row (опционально: тут можно оставить место под внешний компонент) */}
          <View className="mt-5 flex-row gap-2">
            <View className="px-3 py-2 rounded-xl border border-[#E7C11C]/20 bg-black/35">
              <Text className="text-white/80 text-xs">Premium vibes</Text>
            </View>
            <View className="px-3 py-2 rounded-xl border border-white/10 bg-black/25">
              <Text className="text-white/70 text-xs">One tap to listen</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
