/**
 * Publish the paywall / promo config to Firestore (`config/paywall`).
 *
 * Validates the file with the exact same rules the app applies at runtime, so
 * a typo shows up here instead of as a missing banner on a user's phone.
 *
 * Usage:
 *   npm run promo:set -- scripts/paywall-promos/ramadan.example.json
 *   npm run promo:set -- <file> --dry-run     # validate and print, write nothing
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { normalizePaywallConfig, resolveActivePromo } from "../utils/paywall-config";

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");
const CONFIG_COLLECTION = "config";
const PAYWALL_DOC_ID = "paywall";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath = args.find((arg) => !arg.startsWith("--"));

if (!filePath) {
  console.error(
    "Usage: npm run promo:set -- <path/to/paywall.json> [--dry-run]",
  );
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

const raw: unknown = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
const config = normalizePaywallConfig(raw);

const authoredPromos = Array.isArray((raw as { promos?: unknown[] })?.promos)
  ? ((raw as { promos: unknown[] }).promos as unknown[]).length
  : 0;

console.log(`Source:            ${resolvedPath}`);
console.log(`Free daily limit:  ${config.freeDailyLimit}`);
console.log(`Promos accepted:   ${config.promos.length} of ${authoredPromos}`);

if (config.promos.length < authoredPromos) {
  console.warn(
    "Some promos were dropped — a promo needs at least a non-empty `title`.",
  );
}

for (const promo of config.promos) {
  const window = [
    promo.startsAt === null ? "always" : new Date(promo.startsAt).toISOString(),
    promo.endsAt === null ? "no end" : new Date(promo.endsAt).toISOString(),
  ].join(" → ");
  console.log(
    `  - ${promo.id}: "${promo.title}" [${promo.enabled ? "enabled" : "disabled"}] ${window}`,
  );
}

const activeNow = resolveActivePromo(config, Date.now());
console.log(`Active right now:  ${activeNow ? activeNow.id : "none"}`);

if (dryRun) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "Service account key not found at scripts/serviceAccountKey.json\n" +
      "Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: "qasid-fd80d",
});

async function main(): Promise<void> {
  // The normalized config is written (not the raw file) so the document always
  // matches what the app will read back.
  await admin
    .firestore()
    .collection(CONFIG_COLLECTION)
    .doc(PAYWALL_DOC_ID)
    .set(config);
  console.log(`\nWrote ${CONFIG_COLLECTION}/${PAYWALL_DOC_ID}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Failed to write paywall config:", error);
    process.exit(1);
  });
