/**
 * Verify Reciter Audio — checks whether every surah's audio file actually
 * exists in Firebase Storage.
 *
 * `seed-reciters.ts` writes `audio_path` by convention
 * (`audio/<audioDirName>/<surahId>.mp3`) whether or not the file was ever
 * uploaded, so a reciter can look complete in Firestore while Storage is
 * empty. `verify-storage-paths.ts` only covers generated_playlists, which is
 * why that gap stayed invisible.
 *
 * Usage:
 *   npm run verify:reciter-audio
 *
 * Exits 1 if anything is missing, so it can gate a release.
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
    "Service account key not found at scripts/serviceAccountKey.json",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: "qasid-fd80d",
  storageBucket: "qasid-fd80d.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Matches the per-host connection pool; higher just queues at the socket layer.
const BATCH_SIZE = 10;

interface MissingEntry {
  surahNumber: number | undefined;
  docId: string;
  audioPath: string;
  reason: string;
}

async function verifyReciter(
  reciterId: string,
  name: string,
): Promise<MissingEntry[]> {
  const snap = await db
    .collection("reciters")
    .doc(reciterId)
    .collection("surahs")
    .orderBy("surah_number")
    .get();

  const missing: MissingEntry[] = [];

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (docSnap) => {
        const data = docSnap.data();
        const audioPath: string = data.audio_path ?? "";
        const entry = {
          surahNumber: data.surah_number,
          docId: docSnap.id,
          audioPath,
        };

        if (!audioPath) {
          missing.push({ ...entry, reason: "audio_path is empty" });
          return;
        }

        try {
          const [exists] = await bucket.file(audioPath).exists();
          if (!exists) {
            missing.push({ ...entry, reason: "file not in Storage" });
          }
        } catch (err) {
          missing.push({ ...entry, reason: `Storage check error: ${err}` });
        }
      }),
    );
  }

  missing.sort((a, b) => (a.surahNumber ?? 0) - (b.surahNumber ?? 0));

  const label = `[${reciterId}] ${name}`;
  if (missing.length === 0) {
    console.log(`  ✓ ${label} — all ${snap.size} files exist`);
  } else {
    console.log(
      `  ✗ ${label} — ${snap.size - missing.length} OK, ${missing.length} missing`,
    );
    for (const m of missing) {
      console.log(
        `      surah ${String(m.surahNumber ?? "?").padStart(3)}  "${m.audioPath}"  (${m.reason})`,
      );
    }
  }

  return missing;
}

async function main(): Promise<void> {
  console.log("Verifying reciter audio against Firebase Storage...\n");

  const reciters = await db.collection("reciters").get();
  let totalMissing = 0;

  for (const reciter of reciters.docs) {
    const missing = await verifyReciter(
      reciter.id,
      reciter.data().name_en ?? "",
    );
    totalMissing += missing.length;
  }

  if (totalMissing === 0) {
    console.log(
      `\nSummary: all audio files exist across ${reciters.size} reciters`,
    );
    return;
  }

  console.log(`\nSummary: ${totalMissing} file(s) missing from Storage`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
