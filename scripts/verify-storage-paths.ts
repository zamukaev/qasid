/**
 * Verify Storage Paths — checks whether audio files actually exist in Firebase Storage
 *
 * Reads the four target playlists from generated_playlists, then for every
 * track checks if its audio_path file exists in Storage. Prints which tracks
 * are broken.
 *
 * Usage:
 *   npm run verify:storage
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

const TARGET_PLAYLISTS = ["trending_week", "top_100", "mood_motivational", "mood_sleep"];

interface StoredTrack {
  id: string;
  title_en?: string;
  name_en?: string;
  audio_path?: string;
}

async function verifyPlaylist(key: string): Promise<number> {
  const snap = await db.collection("generated_playlists").doc(key).get();
  if (!snap.exists) {
    console.log(`\n[${key}] not found`);
    return 0;
  }

  const data = snap.data()!;
  const tracks: StoredTrack[] = Array.isArray(data.tracks) ? data.tracks : [];

  if (tracks.length === 0) {
    console.log(`\n[${key}] 0 tracks`);
    return 0;
  }

  console.log(`\n[${key}] checking ${tracks.length} tracks...`);

  // Deduplicate
  const seen = new Set<string>();
  const unique: StoredTrack[] = [];
  for (const t of tracks) {
    if (t?.id && !seen.has(t.id)) {
      seen.add(t.id);
      unique.push(t);
    }
  }

  let missing = 0;

  // Check in parallel (batches of 10 to avoid hammering Storage)
  const BATCH = 10;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async (track) => {
        const audioPath = track.audio_path ?? "";
        const label = track.title_en || track.name_en || track.id;

        if (!audioPath) {
          console.log(`  ✗ ${track.id}  "${label}"  →  audio_path is empty`);
          missing++;
          return;
        }

        try {
          const [exists] = await bucket.file(audioPath).exists();
          if (!exists) {
            console.log(
              `  ✗ ${track.id}  "${label}"  →  "${audioPath}"  (FILE NOT IN STORAGE)`,
            );
            missing++;
          }
        } catch (err) {
          console.log(
            `  ✗ ${track.id}  "${label}"  →  "${audioPath}"  (Storage check error: ${err})`,
          );
          missing++;
        }
      }),
    );
  }

  const ok = unique.length - missing;
  if (missing === 0) {
    console.log(`  ✓ all ${ok} files exist in Storage`);
  } else {
    console.log(`  ✓ ${ok} OK  ✗ ${missing} missing from Storage`);
  }

  return missing;
}

async function main(): Promise<void> {
  console.log("Verifying Storage file existence for playlist tracks...");
  let totalMissing = 0;
  for (const key of TARGET_PLAYLISTS) {
    totalMissing += await verifyPlaylist(key);
  }
  console.log(
    `\nSummary: ${totalMissing === 0 ? "all files exist in Storage" : `${totalMissing} file(s) missing from Storage`}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
