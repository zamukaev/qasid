/**
 * Audit Phantom Reciter Documents — read-only diagnostic
 *
 * A reciter doc can be silently fabricated by onReciterPlaybackCreated
 * (backend/functions/src/playback/reciter.ts) if it ever receives a
 * reciterId that isn't a real seeded reciter (e.g. the pre-fix Featured
 * Reciter bug, which sent the featuredItems doc ID instead of the real
 * reciters/{target} ID). Such docs end up with score/count fields but no
 * name_en/name_ar/image_path, and can surface as blank cards in "Popular
 * Reciters" once their popularity_score is > 0.
 *
 * This script flags reciters/{id} docs that look like phantoms: missing
 * name_en, but with play/score activity. It does not delete anything.
 *
 * Usage:
 *   npm run audit:reciters
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");

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

const db = admin.firestore();

async function main(): Promise<void> {
  console.log("Auditing reciters collection for phantom documents...");

  const snapshot = await db.collection("reciters").get();
  console.log(`Scanned ${snapshot.size} reciter document(s).`);

  let phantomCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasName =
      typeof data.name_en === "string" && data.name_en.trim().length > 0;
    const popularityScore = Number(data.popularity_score ?? 0);
    const playCount = Number(data.play_count ?? 0);
    const hasActivity = popularityScore > 0 || playCount > 0;

    if (!hasName && hasActivity) {
      phantomCount++;
      console.log(
        `  ✗ ${doc.id}  →  name_en: (missing)  popularity_score: ${popularityScore}  play_count: ${playCount}  fields: [${Object.keys(data).join(", ")}]`,
      );
    }
  }

  if (phantomCount === 0) {
    console.log("\nSummary: no phantom reciter documents found.");
  } else {
    console.log(
      `\nSummary: ${phantomCount} likely phantom reciter document(s) found.`,
    );
    console.log(
      "  → These were not deleted. Review each one in the Firebase console before removing it,",
    );
    console.log(
      "    and check for matching reciter_plays docs referencing the same reciterId.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
