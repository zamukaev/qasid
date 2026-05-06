/**
 * Seed script: Nasheed Artists + Tracks
 *
 * Firestore path:
 *   artists/{artistId}           — artist document
 *   artists/{artistId}/tracks/{trackId} — tracks sub-collection
 *
 * Usage:
 *   1. Download a Firebase service account key from the Firebase console:
 *      Project Settings → Service accounts → Generate new private key
 *      Save it as scripts/serviceAccountKey.json  (already in .gitignore)
 *   2. npm run seed:artists
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
// Data types
// ---------------------------------------------------------------------------

interface TrackInput {
  title_en: string;
  title_ar: string;
  audio_path: string;
  duration?: number;
}

interface ArtistInput {
  id: string;
  name_en: string;
  name_ar: string;
  language: string;
  tracks: TrackInput[];
}

// ---------------------------------------------------------------------------
// Artist + track data
// ---------------------------------------------------------------------------

const artists: ArtistInput[] = [
  {
    id: "alafasy",
    name_en: "Mishary Rashid Alafasy",
    name_ar: "مشاري راشد العفاسي",
    language: "ar",
    tracks: [
      {
        title_en: "Ya Nabi Salam Alayka",
        title_ar: "يا نبي سلام عليك",
        audio_path: "artists/alafasy/tracks/ya-nabi-salam-alayka.mp3",
      },
      {
        title_en: "Asma Allah Alhusna",
        title_ar: "أسماء الله الحسنى",
        audio_path: "artists/alafasy/tracks/asma-allah-alhusna.mp3",
      },
    ],
  },
  {
    id: "abu-ali",
    name_en: "Abu Ali",
    name_ar: "أبو علي",
    language: "ar",
    tracks: [
      {
        title_en: "Track 1",
        title_ar: "مقطع 1",
        audio_path: "artists/abu-ali/tracks/track-1.mp3",
      },
    ],
  },
  {
    id: "red-leon",
    name_en: "Red Leon",
    name_ar: "ريد ليون",
    language: "ge",
    tracks: [
      {
        title_en: "Track 1",
        title_ar: "مقطع 1",
        audio_path: "artists/red-leon/tracks/track-1.mp3",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedArtists(): Promise<void> {
  const artistsCol = db.collection("artists");

  console.log(`\nSeeding ${artists.length} nasheed artists…\n`);

  for (const artist of artists) {
    const artistRef = artistsCol.doc(artist.id);

    const artistData = {
      name_en: artist.name_en,
      name_ar: artist.name_ar,
      image_path: "",
      is_active: true,
      desc: "",
      language: artist.language,
      isKnown: true,
      popularity_score: 0,
      play_count: 0,
      qualified_play_count: 0,
      completed_play_count: 0,
      publishedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
    };

    await artistRef.set(artistData);
    console.log(`  ✓  artist: ${artist.id}  (${artist.name_en})`);

    const tracksCol = artistRef.collection("tracks");

    for (const track of artist.tracks) {
      const trackId = toSlug(track.title_en);
      const trackData = {
        title_en: track.title_en,
        title_ar: track.title_ar,
        audio_path: track.audio_path,
        duration: track.duration ?? 0,
        is_active: true,
        popularity_score: 0,
        play_count: 0,
        createdAt: admin.firestore.Timestamp.now(),
        publishedAt: admin.firestore.Timestamp.now(),
      };

      await tracksCol.doc(trackId).set(trackData);
      console.log(`      ✓  track: ${trackId}`);
    }
  }

  console.log("\nDone. Structure: artists/{artistId}/tracks/{trackId}\n");
}

seedArtists().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
