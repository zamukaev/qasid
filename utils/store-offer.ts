import type {
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import type {
  IntroOffer,
  IntroPeriodUnit,
  OfferingSummary,
  UnitLabels,
} from "../types/paywall";

/**
 * Everything in this file derives from what the store actually reports. No
 * promo copy may invent a trial or a price the user cannot get — see
 * `utils/promo-text.ts`, which drops any line whose placeholder is missing.
 */

const MONTHLY_PACKAGE_ID = "$rc_monthly";
const ANNUAL_PACKAGE_ID = "$rc_annual";
const MONTHS_PER_YEAR = 12;
const PERCENT = 100;

const PERIOD_UNITS: readonly IntroPeriodUnit[] = [
  "DAY",
  "WEEK",
  "MONTH",
  "YEAR",
];

function asPeriodUnit(value: unknown): IntroPeriodUnit | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return PERIOD_UNITS.find((unit) => unit === upper) ?? null;
}

function positiveCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

/**
 * Google Play reports offers as pricing phases on the default subscription
 * option; StoreKit reports a single `introPrice`. Both are read here so the
 * same promo copy works on either platform.
 */
export function describeIntroOffer(
  product: PurchasesStoreProduct,
): IntroOffer | null {
  const option = product.defaultOption;

  if (option) {
    const freePhase = option.freePhase;
    if (freePhase) {
      const unit = asPeriodUnit(freePhase.billingPeriod.unit);
      if (unit) {
        return {
          kind: "free_trial",
          periodUnit: unit,
          periodCount:
            positiveCount(freePhase.billingPeriod.value, 1) *
            positiveCount(freePhase.billingCycleCount, 1),
          priceString: null,
        };
      }
    }

    const introPhase = option.introPhase;
    if (introPhase) {
      const unit = asPeriodUnit(introPhase.billingPeriod.unit);
      if (unit) {
        return {
          kind: "intro_price",
          periodUnit: unit,
          periodCount:
            positiveCount(introPhase.billingPeriod.value, 1) *
            positiveCount(introPhase.billingCycleCount, 1),
          priceString: introPhase.price.formatted,
        };
      }
    }
  }

  const intro = product.introPrice;
  if (!intro) return null;

  const unit = asPeriodUnit(intro.periodUnit);
  if (!unit) return null;

  return {
    kind: intro.price <= 0 ? "free_trial" : "intro_price",
    periodUnit: unit,
    periodCount:
      positiveCount(intro.periodNumberOfUnits, 1) *
      positiveCount(intro.cycles, 1),
    priceString: intro.price <= 0 ? null : intro.priceString,
  };
}

/** "7 days", "1 month" — wording comes from the remote `unitLabels`. */
export function formatIntroDuration(
  offer: IntroOffer,
  labels: UnitLabels,
): string {
  const plural = offer.periodCount !== 1;
  const label =
    offer.periodUnit === "DAY"
      ? plural
        ? labels.days
        : labels.day
      : offer.periodUnit === "WEEK"
        ? plural
          ? labels.weeks
          : labels.week
        : offer.periodUnit === "MONTH"
          ? plural
            ? labels.months
            : labels.month
          : plural
            ? labels.years
            : labels.year;

  return `${offer.periodCount} ${label}`;
}

/** Real savings of the yearly plan against 12x the monthly one. */
export function computeSavingsPercent(
  monthly: PurchasesPackage | null,
  yearly: PurchasesPackage | null,
): number | null {
  if (!monthly || !yearly) return null;

  const monthlyPrice = monthly.product.price;
  const yearlyPrice = yearly.product.price;
  if (monthlyPrice <= 0 || yearlyPrice <= 0) return null;
  if (monthly.product.currencyCode !== yearly.product.currencyCode) return null;

  const fullYearPrice = monthlyPrice * MONTHS_PER_YEAR;
  const saved = Math.round((1 - yearlyPrice / fullYearPrice) * PERCENT);
  return saved > 0 ? saved : null;
}

function findPackage(
  offering: PurchasesOffering | null,
  identifier: string,
): PurchasesPackage | null {
  return (
    offering?.availablePackages.find((pkg) => pkg.identifier === identifier) ??
    null
  );
}

/**
 * Single place that knows how the offering maps to the two buyable plans, so
 * the premium screen and the gate modal cannot drift apart.
 */
export function summarizeOffering(
  offering: PurchasesOffering | null,
): OfferingSummary {
  const monthlyPackage = findPackage(offering, MONTHLY_PACKAGE_ID);
  const yearlyPackage = findPackage(offering, ANNUAL_PACKAGE_ID);

  return {
    monthlyPackage,
    yearlyPackage,
    monthlyPriceString: monthlyPackage?.product.priceString ?? null,
    yearlyPriceString: yearlyPackage?.product.priceString ?? null,
    monthlyIntroOffer: monthlyPackage
      ? describeIntroOffer(monthlyPackage.product)
      : null,
    yearlyIntroOffer: yearlyPackage
      ? describeIntroOffer(yearlyPackage.product)
      : null,
    savingsPercent: computeSavingsPercent(monthlyPackage, yearlyPackage),
  };
}
