/**
 * Seed script: Abu Ali Nasheeds → nasheeds collection
 *
 * Firestore path:  nasheeds/{abuali_001..011}
 *
 * Usage:
 *   1. Place service account key at scripts/serviceAccountKey.json
 *      (Firebase console → Project Settings → Service accounts → Generate new private key)
 *   2. npm run seed:nasheeds-abu-ali
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "❌  Service account key not found at scripts/serviceAccountKey.json\n" +
      "    Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "qasid-fd80d",
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Track data — add audio filename (without path prefix) for each nasheed
// ---------------------------------------------------------------------------

const ARTIST_ID = "abu-ali";
const NAME_EN = "Abu Ali";
const BASE_PATH = "nasheeds/abu_ali";
const DOC_PREFIX = "abu_ali";

// Mood taxonomy — must stay in sync with NasheedMood in types/nasheed.ts.
type NasheedMood = "calm" | "motivational" | "sleep" | "focus";

interface NasheedInput {
  title_en: string;
  audio_filename: string; // e.g. "ana_maradun.mp3"
  image_filename: string;
  moods?: NasheedMood[]; // curated — drives mood playlists & radio
  tags?: string[]; // freeform — secondary radio signal
}

const tracks: NasheedInput[] = [
  {
    title_en: "Awjiini Ya Jirahi",
    audio_filename: "awjiini_ya_jirahi.mp3",
    image_filename: "awjiini_ya_jirahi.webp",
    moods: ["calm", "focus"],
    tags: ["nasheed", "calm", "relax"],
  },
];
// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedNasheeds(): Promise<void> {
  const nasheedsCol = db.collection("nasheeds");

  console.log(
    `\nSeeding ${tracks.length} nasheeds into 'nasheeds' collection…\n`,
  );

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const docId = `${DOC_PREFIX}_${String(i + 81).padStart(3, "0")}`;

    const docRef = nasheedsCol.doc(docId);
    const existing = await docRef.get();

    // Content + curated metadata is always (re)written.
    const data: Record<string, unknown> = {
      artist_id: ARTIST_ID,
      audio_path: `${BASE_PATH}/${track.audio_filename}`,
      id: docId,
      image_path: `banners/${DOC_PREFIX}/${track.image_filename}`,
      name_en: NAME_EN,
      title_en: track.title_en,
      moods: track.moods ?? [],
      tags: track.tags ?? [],
    };

    // Counters are initialized only when missing so re-seeding never wipes
    // metrics accumulated in production.
    const counters = [
      "popularity_score",
      "trending_score",
      "play_count",
      "qualified_play_count",
      "completed_play_count",
      "favorite_count",
    ];
    const existingData = existing.data() ?? {};
    for (const field of counters) {
      if (existingData[field] === undefined) data[field] = 0;
    }

    await docRef.set(data, { merge: true });
    console.log(`  ✓  ${docId}  →  "${track.title_en}"`);
  }

  console.log("\nDone. All documents written to nasheeds/{nasheed_001…}\n");
}

seedNasheeds().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
