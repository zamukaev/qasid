/**
 * Paywall promo logic checks — pure, offline, no Firebase access.
 *
 * Exercises the same functions the app uses to decide what a promo shows, so a
 * regression in the placeholder/time-window rules is caught without a device.
 *
 * Usage:
 *   npm run check:promo
 */

import type {
  PurchasesPackage,
  PurchasesStoreProduct,
} from "react-native-purchases";
import {
  DEFAULT_UNIT_LABELS,
  normalizePaywallConfig,
  resolveActivePromo,
} from "../utils/paywall-config";
import {
  formatTimeRemaining,
  renderPromoText,
} from "../utils/promo-text";
import {
  computeSavingsPercent,
  describeIntroOffer,
  formatIntroDuration,
} from "../utils/store-offer";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures++;
  console.error(`  FAIL ${label}\n       expected ${expectedJson}\n       got      ${actualJson}`);
}

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-03-10T12:00:00Z");

const config = normalizePaywallConfig({
  freeDailyLimit: 3,
  promos: [
    {
      id: "expired",
      title: "Old",
      endsAt: "2026-03-01T00:00:00Z",
    },
    {
      id: "future",
      title: "Later",
      startsAt: "2026-04-01T00:00:00Z",
    },
    {
      id: "disabled",
      enabled: false,
      title: "Off",
    },
    {
      id: "ramadan",
      title: "First month free",
      subtitle: "{trial} free, then {price}.",
      endsAt: "2026-03-30T00:00:00Z",
      discountPercent: 30,
      highlightPlan: "yearly",
      showCountdown: true,
    },
  ],
});

console.log("config normalization");
check("free daily limit", config.freeDailyLimit, 3);
check("promo count", config.promos.length, 4);
check("defaults for a bare doc", normalizePaywallConfig(undefined).freeDailyLimit, 5);
check("garbage doc is ignored", normalizePaywallConfig("nope").promos, []);
check(
  "promo without a title is dropped",
  normalizePaywallConfig({ promos: [{ id: "x" }] }).promos,
  [],
);
check(
  "invalid discount is dropped",
  normalizePaywallConfig({ promos: [{ title: "t", discountPercent: 250 }] })
    .promos[0].discountPercent,
  null,
);

console.log("time window");
check("active promo wins", resolveActivePromo(config, NOW)?.id, "ramadan");
check(
  "a promo without startsAt is active right away",
  resolveActivePromo(config, Date.parse("2026-03-05T00:00:00Z"))?.id,
  "ramadan",
);
check(
  "expired promo stops winning after endsAt",
  resolveActivePromo(config, Date.parse("2026-05-01T00:00:00Z"))?.id,
  "future",
);
check(
  "nothing active when every promo is out of its window",
  resolveActivePromo(
    normalizePaywallConfig({
      promos: [{ title: "Old", endsAt: "2026-03-01T00:00:00Z" }],
    }),
    NOW,
  ),
  null,
);
check(
  "a disabled promo never wins",
  resolveActivePromo(
    normalizePaywallConfig({ promos: [{ title: "Off", enabled: false }] }),
    NOW,
  ),
  null,
);

console.log("placeholders");
const vars = { trial: "1 month", price: "$29.99", limit: "3", plays_left: null };
check(
  "resolved text",
  renderPromoText("{trial} free, then {price}.", vars),
  "1 month free, then $29.99.",
);
check(
  "unresolvable placeholder drops the line",
  renderPromoText("You have {plays_left} plays left", vars),
  null,
);
check(
  "missing variable drops the line",
  renderPromoText("Save {unknown_token}", vars),
  null,
);
check("plain text passes through", renderPromoText("Ramadan Special", vars), "Ramadan Special");

console.log("countdown");
check("days and hours", formatTimeRemaining(50 * HOUR), "2d 2h");
check("hours and minutes", formatTimeRemaining(3 * HOUR + 12 * 60 * 1000), "3h 12m");
check("minutes and seconds", formatTimeRemaining(4 * 60 * 1000 + 21 * 1000), "4m 21s");
check("expired", formatTimeRemaining(-1), null);

console.log("store offers");
const storeKitTrial = {
  introPrice: {
    price: 0,
    priceString: "$0.00",
    cycles: 1,
    period: "P1M",
    periodUnit: "MONTH",
    periodNumberOfUnits: 1,
  },
  defaultOption: null,
} as unknown as PurchasesStoreProduct;

const playStoreTrial = {
  introPrice: null,
  defaultOption: {
    freePhase: {
      billingPeriod: { unit: "DAY", value: 7, iso8601: "P7D" },
      billingCycleCount: 1,
    },
    introPhase: null,
  },
} as unknown as PurchasesStoreProduct;

const introPriced = {
  introPrice: {
    price: 1.99,
    priceString: "$1.99",
    cycles: 3,
    period: "P1M",
    periodUnit: "MONTH",
    periodNumberOfUnits: 1,
  },
  defaultOption: null,
} as unknown as PurchasesStoreProduct;

const noOffer = {
  introPrice: null,
  defaultOption: null,
} as unknown as PurchasesStoreProduct;

check("StoreKit free trial", describeIntroOffer(storeKitTrial), {
  kind: "free_trial",
  periodUnit: "MONTH",
  periodCount: 1,
  priceString: null,
});
check("Play Store free trial", describeIntroOffer(playStoreTrial), {
  kind: "free_trial",
  periodUnit: "DAY",
  periodCount: 7,
  priceString: null,
});
check("intro price with cycles", describeIntroOffer(introPriced), {
  kind: "intro_price",
  periodUnit: "MONTH",
  periodCount: 3,
  priceString: "$1.99",
});
check("no offer configured", describeIntroOffer(noOffer), null);
check(
  "duration wording, singular",
  formatIntroDuration(describeIntroOffer(storeKitTrial)!, DEFAULT_UNIT_LABELS),
  "1 month",
);
check(
  "duration wording, plural",
  formatIntroDuration(describeIntroOffer(playStoreTrial)!, DEFAULT_UNIT_LABELS),
  "7 days",
);
check(
  "duration wording, remote labels",
  formatIntroDuration(describeIntroOffer(playStoreTrial)!, {
    ...DEFAULT_UNIT_LABELS,
    days: "Tage",
  }),
  "7 Tage",
);

const pkg = (price: number, currencyCode = "USD"): PurchasesPackage =>
  ({ product: { price, currencyCode } }) as unknown as PurchasesPackage;

check("yearly savings", computeSavingsPercent(pkg(4.99), pkg(39.99)), 33);
check("no savings when yearly is not cheaper", computeSavingsPercent(pkg(4.99), pkg(59.88)), null);
check("mixed currencies are not compared", computeSavingsPercent(pkg(4.99), pkg(39.99, "EUR")), null);
check("missing package", computeSavingsPercent(null, pkg(39.99)), null);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll paywall promo checks passed");
