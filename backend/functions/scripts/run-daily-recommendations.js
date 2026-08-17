/**
 * Manually run the deployed `dailyRecommendationJob` handler locally.
 *
 * Executes the exact same code as the scheduled Cloud Function (no logic is
 * duplicated here) against production Firestore, using the Admin service
 * account key. Use it after deleting or re-seeding audio so that
 * trending / top / mood playlists are rebuilt immediately instead of waiting
 * for the next scheduled run.
 *
 * Usage (from the repo root):
 *   npm run recompute:trending
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

const path = require("path");
const fs = require("fs");

const PROJECT_ID = "qasid-fd80d";
const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  "../../../scripts/serviceAccountKey.json",
);

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "Service account key not found at scripts/serviceAccountKey.json\n" +
      "Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;

const {dailyRecommendationJob} = require("../lib/recommendations/playlists");

async function main() {
  console.log(`Running dailyRecommendationJob against ${PROJECT_ID}...`);
  await dailyRecommendationJob.run({
    jobName: "manual-local-run",
    scheduleTime: new Date().toISOString(),
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
