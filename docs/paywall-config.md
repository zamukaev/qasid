# Paywall & promo config

Promotions shown in the premium gate modal and on the premium screen are
authored in **Firestore → `config` → `paywall`**. Editing that document changes
the app for everyone within ~15 minutes (or on the next app start) — **no code
change, no app release**.

Read by `services/paywall-config-service.ts`, normalized by
`utils/paywall-config.ts`, rendered by `components/PromoBanner.tsx`.

## Document shape

```jsonc
{
  "freeDailyLimit": 5,
  "promos": [
    {
      "id": "ramadan-2027",
      "enabled": true,
      "startsAt": "2027-02-08T00:00:00Z",
      "endsAt": "2027-03-10T00:00:00Z",
      "emoji": "🌙",
      "badge": "Ramadan offer",
      "title": "Your first month is on us",
      "subtitle": "{trial} free, then {price_yearly} per year.",
      "discountPercent": 30,
      "highlightPlan": "yearly",
      "ctaLabel": "Start free →",
      "showCountdown": true,
      "showOnGate": true,
      "showOnPremiumScreen": true,
      "gateTitle": "Daily limit reached",
      "gateBody": "Free listeners get {limit} nasheeds a day. Premium is unlimited."
    }
  ]
}
```

### Top-level fields

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `freeDailyLimit` | number | `5` | Nasheeds a free user may play per day. Drives both the enforcement (`hooks/useNasheedLimit.ts`) and the `{limit}` placeholder. |
| `unitLabels` | object | English | Words for durations, e.g. `{ "day": "Tag", "days": "Tage", "month": "Monat", "months": "Monate", ... }`. Used by `{trial}` / `{intro_duration}`. |
| `promos` | array | `[]` | Promotions, **first active one wins**. |

### Promo fields

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | `promo-<index>` | Free-form identifier. |
| `enabled` | boolean | `true` | Off switch that keeps the entry for later reuse. |
| `startsAt` / `endsAt` | ISO string, epoch ms, or Firestore Timestamp | `null` | Time window. `null` = no bound. |
| `emoji` | string | – | Shown left of the title. |
| `badge` | string | – | Small uppercase label above the title. |
| `title` | string | **required** | Without it the promo is ignored. |
| `subtitle` | string | – | Second line. |
| `discountPercent` | number 1–99 | – | Marketing chip `-30%`. Purely a label — the real price always comes from the store. |
| `highlightPlan` | `"monthly"` \| `"yearly"` | – | Which plan `{price}` refers to; also preselects that card for free users who have not chosen yet. |
| `ctaLabel` | string | – | Replaces "Upgrade to Premium →". |
| `showCountdown` | boolean | `false` | Live countdown chip until `endsAt`. |
| `showOnGate` / `showOnPremiumScreen` | boolean | `true` | Where the banner appears. |
| `gateTitle` / `gateBody` | string | – | Override the gate modal's headline and body. |

## Placeholders

Usable in every text field. Values come from real data:

| Placeholder | Source |
| --- | --- |
| `{price}` | Price of `highlightPlan` (yearly if unset). |
| `{price_monthly}`, `{price_yearly}` | Store price of that plan. |
| `{trial}` | **Free trial length reported by the store**, e.g. "7 days". |
| `{intro_price}`, `{intro_duration}` | Introductory price and its duration. |
| `{discount}` | `discountPercent` as `"30%"`. |
| `{savings}` | Real yearly savings vs. 12× monthly, e.g. `"33%"`. |
| `{limit}` | `freeDailyLimit`. |
| `{plays_left}` | Remaining free plays (gate modal only). |
| `{ends_in}` | Time left, e.g. `"2d 5h"`. |

**Important:** if a placeholder cannot be resolved — typically `{trial}` when
App Store Connect / Play Console has no trial configured — that whole line is
**dropped**, and if the `title` was affected the promo is not shown at all. A
promo can therefore never advertise an offer the store does not actually give.
Free trials and intro prices are configured in App Store Connect / Play Console,
not here; this document only supplies the wording around them.

## Recipes

**First month free** (trial must exist in the stores):

```json
{ "id": "first-month-free", "title": "First month free",
  "subtitle": "{trial} free, then {price}. Cancel anytime.",
  "highlightPlan": "monthly", "ctaLabel": "Start free →" }
```

**Yearly discount with a countdown:**

```json
{ "id": "yearly-30", "title": "Save {savings} with yearly",
  "subtitle": "Offer ends in {ends_in}.", "discountPercent": 30,
  "highlightPlan": "yearly", "endsAt": "2027-01-31T23:59:59Z",
  "showCountdown": true }
```

**Event banner, no pricing claim:**

```json
{ "id": "ramadan-banner", "emoji": "🌙", "badge": "Ramadan",
  "title": "Listen without limits this Ramadan", "showOnGate": true }
```

**Turn everything off:** set `"enabled": false` on each promo, or `"promos": []`.
The app then falls back to its built-in English copy.

## Publishing

Edit the document directly in the Firebase console, or publish a file:

```bash
npm run promo:set -- scripts/paywall-promos/ramadan.example.json --dry-run  # validate
npm run promo:set -- scripts/paywall-promos/ramadan.example.json           # write
```

`config/**` is world-readable and client-write-protected by
`backend/firestore.rules`, so writing needs the Firebase console or the Admin
SDK key at `scripts/serviceAccountKey.json`.

Logic checks: `npm run check:promo`.
