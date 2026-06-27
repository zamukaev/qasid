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

const ARTIST_ID = "ahmed-bukhatir";
const NAME_EN = "Ahmed Bukhatir";
const BASE_PATH = "nasheeds/ahmed_bukhatir";
const DOC_PREFIX = "ahmed_bukhatir";

// Mood taxonomy — must stay in sync with Mood in types/nasheed.ts.
type NasheedMood = "calm" | "motivational" | "sleep" | "focus";

interface NasheedInput {
  title_en: string;
  audio_filename: string; // e.g. "ana_maradun.mp3"
  moods?: NasheedMood[]; // curated — drives mood playlists & radio
}

const tracks: NasheedInput[] = [
  { title_en: "Ya Adheeman", audio_filename: "ya_adheeman.mp3", moods: ["calm", "focus"] },
  { title_en: "Al Hejaab", audio_filename: "al_hejaab.mp3", moods: ["focus", "motivational"] },
  { title_en: "Daar Aa Ghoroor", audio_filename: "daar_aa_ghoroor.mp3", moods: ["focus", "calm"] },
  { title_en: "Fartaqi", audio_filename: "fartaqi.mp3", moods: ["motivational"] },
  { title_en: "Fartaqi Ya Eid", audio_filename: "fartaqi_ya_eid.mp3", moods: ["calm", "motivational"] },
  { title_en: "Ketaab Allah", audio_filename: "ketaab_allah.mp3", moods: ["calm", "focus"] },
  { title_en: "Taaleb Al Elm", audio_filename: "taaleb_al_elm.mp3", moods: ["motivational", "focus"] },
  { title_en: "Ya Man Yara", audio_filename: "ya_man_yara.mp3", moods: ["calm", "focus"] },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedNasheeds(): Promise<void> {
  const nasheedsCol = db.collection("nasheeds");

  console.log(
    `\nSeeding ${tracks.length} Ahmed Bukhatir nasheeds into 'nasheeds' collection…\n`,
  );

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const docId = `${DOC_PREFIX}_${String(i + 1).padStart(3, "0")}`;

    const docRef = nasheedsCol.doc(docId);
    const existing = await docRef.get();

    // Content + curated metadata is always (re)written.
    const data: Record<string, unknown> = {
      artist_id: ARTIST_ID,
      audio_path: `${BASE_PATH}/${track.audio_filename}`,
      id: docId,
      image_path: "",
      name_en: NAME_EN,
      title_en: track.title_en,
      moods: track.moods ?? [],
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

  console.log(
    "\nDone. All documents written to nasheeds/{ahmed_bukhatir_001…}\n",
  );
}

seedNasheeds().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
