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

interface ArtistInput {
  id: string;
  name_en: string;
  name_ar: string;
  language: string;
}

// ---------------------------------------------------------------------------
// Artist + track data
// ---------------------------------------------------------------------------

const artists: ArtistInput[] = [
  {
    id: "osama-al-safi",
    name_en: "osama al-safi",
    name_ar: "أسامة الصافي",
    language: "ar",
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
      id: artist.id,
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
  }

  console.log("\nDone. Structure: artists/{artistId}/tracks/{trackId}\n");
}

seedArtists().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
