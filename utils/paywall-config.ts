import type {
  PaywallConfig,
  PromoConfig,
  PromoPlanId,
  UnitLabels,
} from "../types/paywall";

/**
 * Pure normalization for the remote paywall config. Deliberately free of any
 * Firebase / React Native import so the admin scripts can validate a promo
 * with exactly the same rules the app applies at runtime.
 */

export const DEFAULT_FREE_DAILY_LIMIT = 5;

export const DEFAULT_UNIT_LABELS: UnitLabels = {
  day: "day",
  days: "days",
  week: "week",
  weeks: "weeks",
  month: "month",
  months: "months",
  year: "year",
  years: "years",
};

export const DEFAULT_PAYWALL_CONFIG: PaywallConfig = {
  freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
  unitLabels: DEFAULT_UNIT_LABELS,
  promos: [],
};

const PLAN_IDS: readonly PromoPlanId[] = ["monthly", "yearly"];
const MAX_DISCOUNT_PERCENT = 100;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Accepts what the Firebase console and the Admin SDK can produce: an epoch
 * number, an ISO string, or a Firestore Timestamp (`toMillis()` / `seconds`).
 */
export function asEpochMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const record = asRecord(value);
  if (!record) return null;

  const toMillis = record.toMillis;
  if (typeof toMillis === "function") {
    const millis = (toMillis as () => unknown).call(value);
    return typeof millis === "number" && Number.isFinite(millis)
      ? millis
      : null;
  }

  const seconds = record.seconds ?? record._seconds;
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? seconds * 1000
    : null;
}

function asPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 && rounded < MAX_DISCOUNT_PERCENT ? rounded : null;
}

function asPlanId(value: unknown): PromoPlanId | null {
  const text = asText(value);
  return PLAN_IDS.find((plan) => plan === text) ?? null;
}

function normalizePromo(value: unknown, index: number): PromoConfig | null {
  const raw = asRecord(value);
  if (!raw) return null;

  // A promo without a title has nothing to render, so it is dropped instead of
  // showing an empty banner.
  const title = asText(raw.title);
  if (!title) return null;

  return {
    id: asText(raw.id) ?? `promo-${index}`,
    enabled: asBoolean(raw.enabled, true),
    startsAt: asEpochMillis(raw.startsAt),
    endsAt: asEpochMillis(raw.endsAt),
    emoji: asText(raw.emoji),
    badge: asText(raw.badge),
    title,
    subtitle: asText(raw.subtitle),
    discountPercent: asPercent(raw.discountPercent),
    highlightPlan: asPlanId(raw.highlightPlan),
    ctaLabel: asText(raw.ctaLabel),
    showCountdown: asBoolean(raw.showCountdown, false),
    showOnGate: asBoolean(raw.showOnGate, true),
    showOnPremiumScreen: asBoolean(raw.showOnPremiumScreen, true),
    gateTitle: asText(raw.gateTitle),
    gateBody: asText(raw.gateBody),
  };
}

function normalizeUnitLabels(value: unknown): UnitLabels {
  const raw = asRecord(value);
  if (!raw) return DEFAULT_UNIT_LABELS;

  const entries = Object.keys(DEFAULT_UNIT_LABELS).map((key) => {
    const typedKey = key as keyof UnitLabels;
    return [typedKey, asText(raw[typedKey]) ?? DEFAULT_UNIT_LABELS[typedKey]];
  });

  return Object.fromEntries(entries) as UnitLabels;
}

function normalizeDailyLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_FREE_DAILY_LIMIT;
  }
  const rounded = Math.floor(value);
  return rounded >= 0 ? rounded : DEFAULT_FREE_DAILY_LIMIT;
}

/**
 * Turns whatever sits in `config/paywall` into a usable config. Never throws:
 * a malformed document must degrade to the shipped defaults, not break the
 * paywall.
 */
export function normalizePaywallConfig(value: unknown): PaywallConfig {
  const raw = asRecord(value);
  if (!raw) return DEFAULT_PAYWALL_CONFIG;

  const promos = Array.isArray(raw.promos)
    ? raw.promos
        .map(normalizePromo)
        .filter((promo): promo is PromoConfig => promo !== null)
    : [];

  return {
    freeDailyLimit: normalizeDailyLimit(raw.freeDailyLimit),
    unitLabels: normalizeUnitLabels(raw.unitLabels),
    promos,
  };
}

/** First promo that is enabled and inside its time window. */
export function resolveActivePromo(
  config: PaywallConfig,
  now: number,
): PromoConfig | null {
  return (
    config.promos.find(
      (promo) =>
        promo.enabled &&
        (promo.startsAt === null || now >= promo.startsAt) &&
        (promo.endsAt === null || now < promo.endsAt),
    ) ?? null
  );
}
