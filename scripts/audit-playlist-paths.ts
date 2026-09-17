/**
 * Audit Generated Playlist Audio Paths — read-only diagnostic
 *
 * Checks four playlists in generated_playlists for tracks with wrong,
 * missing, or stale audio_path values by cross-referencing against the
 * source nasheeds collection.
 *
 * Usage:
 *   npm run audit:playlists
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

const TARGET_PLAYLISTS = ["trending_week", "top_100", "mood_motivational", "mood_sleep"];

interface StoredTrack {
  id: string;
  title_en?: string;
  name_en?: string;
  audio_path?: string;
}

async function auditPlaylist(key: string): Promise<number> {
  const snap = await db.collection("generated_playlists").doc(key).get();

  if (!snap.exists) {
    console.log(`\n[${key}] document not found in generated_playlists`);
    return 0;
  }

  const data = snap.data()!;
  const tracks: StoredTrack[] = Array.isArray(data.tracks) ? data.tracks : [];

  if (tracks.length === 0) {
    console.log(`\n[${key}] 0 tracks`);
    return 0;
  }

  console.log(`\n[${key}] ${tracks.length} tracks`);

  // Deduplicate track IDs while preserving order.
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  const trackById = new Map<string, StoredTrack>();
  for (const t of tracks) {
    if (t && typeof t.id === "string" && !seen.has(t.id)) {
      seen.add(t.id);
      orderedIds.push(t.id);
      trackById.set(t.id, t);
    }
  }

  // Batch-fetch source nasheed docs in chunks of 100.
  const nasheedsCol = db.collection("nasheeds");
  const sourceById = new Map<string, admin.firestore.DocumentData | null>();
  const CHUNK = 100;

  for (let i = 0; i < orderedIds.length; i += CHUNK) {
    const chunk = orderedIds.slice(i, i + CHUNK);
    const refs = chunk.map((id) => nasheedsCol.doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      sourceById.set(s.id, s.exists ? s.data() ?? null : null);
    }
  }

  let badCount = 0;

  for (const id of orderedIds) {
    const stored = trackById.get(id)!;
    const source = sourceById.get(id);
    const label = stored.title_en || stored.name_en || id;
    const playlistPath = stored.audio_path ?? "";

    if (source === null) {
      // Nasheed doc no longer exists in Firestore.
      console.log(
        `  ✗ ${id}  "${label}"  →  nasheed doc NOT FOUND in nasheeds collection`,
      );
      badCount++;
      continue;
    }

    const sourcePath: string =
      typeof source?.audio_path === "string" ? source.audio_path : "";

    if (!playlistPath && !sourcePath) {
      console.log(
        `  ✗ ${id}  "${label}"  →  audio_path MISSING in both playlist and nasheed doc`,
      );
      badCount++;
    } else if (!playlistPath && sourcePath) {
      console.log(
        `  ✗ ${id}  "${label}"  →  playlist: (empty)  /  nasheed doc: "${sourcePath}"  (MISSING in playlist — run refresh:playlists)`,
      );
      badCount++;
    } else if (playlistPath && !sourcePath) {
      console.log(
        `  ✗ ${id}  "${label}"  →  playlist: "${playlistPath}"  /  nasheed doc: (empty)  (SOURCE missing audio_path)`,
      );
      badCount++;
    } else if (playlistPath !== sourcePath) {
      console.log(
        `  ✗ ${id}  "${label}"  →  playlist: "${playlistPath}"  /  nasheed doc: "${sourcePath}"  (MISMATCH — run refresh:playlists)`,
      );
      badCount++;
    }
  }

  const okCount = orderedIds.length - badCount;
  if (badCount === 0) {
    console.log(`  ✓ all ${okCount} tracks OK`);
  } else {
    console.log(`  ✓ ${okCount} OK  ✗ ${badCount} bad`);
  }

  return badCount;
}

async function main(): Promise<void> {
  console.log("Auditing playlist audio paths...");
  let totalBad = 0;
  for (const key of TARGET_PLAYLISTS) {
    totalBad += await auditPlaylist(key);
  }
  console.log(
    `\nSummary: ${totalBad === 0 ? "no issues found" : `${totalBad} bad track(s) across ${TARGET_PLAYLISTS.length} playlists`}`,
  );
  if (totalBad > 0) {
    console.log(
      "  → Run `npm run refresh:playlists` to fix MISMATCH/MISSING issues.",
    );
    console.log(
      "  → SOURCE missing issues require fixing the nasheed doc directly in Firestore.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
