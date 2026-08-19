import { useEffect, useMemo, useState } from "react";
import { usePaywallStore } from "../stores/paywallStore";
import {
  IntroOffer,
  OfferingSummary,
  PromoPlanId,
  UnitLabels,
} from "../types/paywall";
import { resolveActivePromo } from "../utils/paywall-config";
import {
  countdownIntervalMs,
  formatTimeRemaining,
  renderPromoText,
} from "../utils/promo-text";
import { formatIntroDuration } from "../utils/store-offer";
import { useOfferingsSummary } from "./useOfferingsSummary";

/** A promo with every placeholder already resolved against real store data. */
export interface ResolvedPromo {
  id: string;
  emoji: string | null;
  badge: string | null;
  title: string;
  subtitle: string | null;
  discountPercent: number | null;
  savingsPercent: number | null;
  highlightPlan: PromoPlanId | null;
  ctaLabel: string | null;
  gateTitle: string | null;
  gateBody: string | null;
  showOnGate: boolean;
  showOnPremiumScreen: boolean;
  /** Countdown text, present only while `showCountdown` is on and time is left. */
  countdown: string | null;
}

interface UsePromoOptions {
  /**
   * Pass the summary when the screen already loaded offerings (premium screen)
   * so we do not fetch them twice.
   */
  summary?: OfferingSummary | null;
  playsLeft?: number;
}

interface UsePromoResult {
  promo: ResolvedPromo | null;
  freeDailyLimit: number;
  unitLabels: UnitLabels;
  summary: OfferingSummary | null;
}

function trialLabel(
  offer: IntroOffer | null,
  labels: UnitLabels,
): string | null {
  return offer && offer.kind === "free_trial"
    ? formatIntroDuration(offer, labels)
    : null;
}

function introPriceLabel(offer: IntroOffer | null): string | null {
  return offer && offer.kind === "intro_price" ? offer.priceString : null;
}

export function usePromo(options: UsePromoOptions = {}): UsePromoResult {
  const { summary: providedSummary, playsLeft } = options;
  const config = usePaywallStore((state) => state.config);
  const hydrate = usePaywallStore((state) => state.hydrate);

  // Only fetch offerings ourselves when the caller has none — see
  // `useOfferingsSummary`.
  const ownSummary = useOfferingsSummary(providedSummary === undefined);
  const summary = providedSummary ?? ownSummary;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const activePromo = resolveActivePromo(config, now);

  // Tick only while a promo actually has an end date: a permanent promo (or
  // none at all) must not keep a timer alive behind every screen.
  const endsAt = activePromo?.endsAt ?? null;
  const showCountdown = activePromo?.showCountdown ?? false;

  useEffect(() => {
    if (endsAt === null) return;

    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      setNow(Date.now());
      return;
    }

    const interval = showCountdown
      ? countdownIntervalMs(remaining)
      : Math.min(remaining, countdownIntervalMs(remaining));

    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [endsAt, showCountdown, now]);

  const promo = useMemo<ResolvedPromo | null>(() => {
    if (!activePromo) return null;

    const { unitLabels } = config;
    const plan: PromoPlanId =
      activePromo.highlightPlan ??
      (summary?.yearlyPackage ? "yearly" : "monthly");

    const planIntro =
      plan === "yearly"
        ? (summary?.yearlyIntroOffer ?? null)
        : (summary?.monthlyIntroOffer ?? null);
    const planPrice =
      plan === "yearly"
        ? (summary?.yearlyPriceString ?? null)
        : (summary?.monthlyPriceString ?? null);

    const remaining =
      activePromo.endsAt === null ? null : activePromo.endsAt - now;
    const endsIn = remaining === null ? null : formatTimeRemaining(remaining);

    const vars = {
      price: planPrice,
      price_monthly: summary?.monthlyPriceString ?? null,
      price_yearly: summary?.yearlyPriceString ?? null,
      trial: trialLabel(planIntro, unitLabels),
      intro_price: introPriceLabel(planIntro),
      intro_duration: planIntro
        ? formatIntroDuration(planIntro, unitLabels)
        : null,
      discount:
        activePromo.discountPercent === null
          ? null
          : `${activePromo.discountPercent}%`,
      savings:
        summary?.savingsPercent === undefined ||
        summary?.savingsPercent === null
          ? null
          : `${summary.savingsPercent}%`,
      limit: String(config.freeDailyLimit),
      plays_left: playsLeft === undefined ? null : String(playsLeft),
      ends_in: endsIn,
    } as const;

    const title = renderPromoText(activePromo.title, vars);
    // Without a title there is no banner worth showing, and the screens fall
    // back to their built-in copy.
    if (!title) return null;

    return {
      id: activePromo.id,
      emoji: activePromo.emoji,
      badge: renderPromoText(activePromo.badge, vars),
      title,
      subtitle: renderPromoText(activePromo.subtitle, vars),
      discountPercent: activePromo.discountPercent,
      savingsPercent: summary?.savingsPercent ?? null,
      highlightPlan: activePromo.highlightPlan,
      ctaLabel: renderPromoText(activePromo.ctaLabel, vars),
      gateTitle: renderPromoText(activePromo.gateTitle, vars),
      gateBody: renderPromoText(activePromo.gateBody, vars),
      showOnGate: activePromo.showOnGate,
      showOnPremiumScreen: activePromo.showOnPremiumScreen,
      countdown: activePromo.showCountdown ? endsIn : null,
    };
  }, [activePromo, config, now, playsLeft, summary]);

  return {
    promo,
    freeDailyLimit: config.freeDailyLimit,
    unitLabels: config.unitLabels,
    summary,
  };
}
