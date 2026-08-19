import type { PurchasesPackage } from "react-native-purchases";

/** Plans a promo can point at. Mirrors the buyable plans on the premium screen. */
export type PromoPlanId = "monthly" | "yearly";

/** Words used to render durations ("7 days", "1 month") — overridable per language. */
export interface UnitLabels {
  day: string;
  days: string;
  week: string;
  weeks: string;
  month: string;
  months: string;
  year: string;
  years: string;
}

/**
 * A single marketing promotion, authored in Firestore (`config/paywall`).
 * Every text field may contain `{placeholders}` — see `utils/promo-text.ts`.
 */
export interface PromoConfig {
  id: string;
  enabled: boolean;
  /** Epoch ms. null = active immediately / forever. */
  startsAt: number | null;
  endsAt: number | null;
  emoji: string | null;
  badge: string | null;
  title: string;
  subtitle: string | null;
  /** Marketing-only badge such as "-30%". Store prices are never derived from it. */
  discountPercent: number | null;
  highlightPlan: PromoPlanId | null;
  ctaLabel: string | null;
  showCountdown: boolean;
  showOnGate: boolean;
  showOnPremiumScreen: boolean;
  gateTitle: string | null;
  gateBody: string | null;
}

export interface PaywallConfig {
  freeDailyLimit: number;
  unitLabels: UnitLabels;
  promos: PromoConfig[];
}

export type IntroOfferKind = "free_trial" | "intro_price";

export type IntroPeriodUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

/**
 * An introductory offer as the store actually reports it. Never authored by
 * hand — it comes from App Store Connect / Play Console via RevenueCat. The
 * duration stays unformatted here so `unitLabels` can render it per language.
 */
export interface IntroOffer {
  kind: IntroOfferKind;
  periodUnit: IntroPeriodUnit;
  /** Total number of units, cycles already multiplied in. */
  periodCount: number;
  /** Formatted price for an intro price; null for a free trial. */
  priceString: string | null;
}

export interface OfferingSummary {
  monthlyPackage: PurchasesPackage | null;
  yearlyPackage: PurchasesPackage | null;
  monthlyPriceString: string | null;
  yearlyPriceString: string | null;
  monthlyIntroOffer: IntroOffer | null;
  yearlyIntroOffer: IntroOffer | null;
  /** Real savings of yearly vs. 12x monthly, rounded percent. null if not derivable. */
  savingsPercent: number | null;
}
