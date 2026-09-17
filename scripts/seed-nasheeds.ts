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

const ARTIST_ID = "abu_abdulmalik";
const NAME_EN = "Abu Abdul Malik";
const BASE_PATH = "nasheeds/abu_abdulmalik";
const DOC_PREFIX = "abu_abdulmalik";

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
    title_en: "Abshiri Ya Taiba Mukarrara",
    audio_filename: "abshiri_ya_taiba_mukarrara.mp3",
    image_filename: "abshiri_ya_taiba_mukarrara.webp",
    moods: [],
    tags: ["nasheed", "madinah", "praise"],
  },
  {
    title_en: "Amsat Maali An Nasri Min Kalimati",
    audio_filename: "amsat_maali_an_nasri_min_kalimati.mp3",
    image_filename: "amsat_maali_an_nasri_min_kalimati.webp",
    moods: [],
    tags: ["nasheed", "strength", "victory"],
  },
  {
    title_en: "Amsat Maali An Nasri Min Kalimati Mukarrara",
    audio_filename: "amsat_maali_an_nasri_min_kalimati_mukarrara.mp3",
    image_filename: "amsat_maali_an_nasri_min_kalimati_mukarrara.webp",
    moods: [],
    tags: ["nasheed", "strength", "victory"],
  },
  {
    title_en: "Ash Shawqu Narun Kawiya",
    audio_filename: "ash_shawqu_narun_kawiya.mp3",
    image_filename: "ash_shawqu_narun_kawiya.webp",
    moods: [],
    tags: ["nasheed", "longing", "heart"],
  },
  {
    title_en: "Atashu Am Fuaduka Ghayru Sahi",
    audio_filename: "atashu_am_fuaduka_ghayru_sahi.mp3",
    image_filename: "atashu_am_fuaduka_ghayru_sahi.webp",
    moods: [],
    tags: ["nasheed", "heart", "reflection"],
  },
  {
    title_en: "Atukhfi As Sua An Kulli Al Baraya",
    audio_filename: "atukhfi_as_sua_an_kulli_al_baraya.mp3",
    image_filename: "atukhfi_as_sua_an_kulli_al_baraya.webp",
    moods: ["calm"],
    tags: ["nasheed", "reflection", "faith"],
  },
  {
    title_en: "Ayyu Jurhin Fi Fuad Al Majdi Ghair",
    audio_filename: "ayyu_jurhin_fi_fuad_al_majdi_ghair.mp3",
    image_filename: "ayyu_jurhin_fi_fuad_al_majdi_ghair.webp",
    moods: [],
    tags: ["nasheed", "heart", "strength"],
  },
  {
    title_en: "Badaa Al Masiru Ila Al Hadaf",
    audio_filename: "badaa_al_masiru_ila_al_hadaf.mp3",
    image_filename: "badaa_al_masiru_ila_al_hadaf.webp",
    moods: ["motivational"],
    tags: ["nasheed", "journey", "purpose"],
  },
  {
    title_en: "Ghurabaa Lakin Rabbuna Allah",
    audio_filename: "ghurabaa_lakin_rabbuna_allah.mp3",
    image_filename: "ghurabaa_lakin_rabbuna_allah.webp",
    moods: [],
    tags: ["nasheed", "faith", "allah", "strangers"],
  },
  {
    title_en: "Hajara Al Ladhaidha Wanbara",
    audio_filename: "hajara_al_ladhaidha_wanbara.mp3",
    image_filename: "hajara_al_ladhaidha_wanbara.webp",
    moods: [],
    tags: ["nasheed", "faith", "sacrifice"],
  },
  {
    title_en: "Kafa Ya Nafsu Ma Kan",
    audio_filename: "kafa_ya_nafsu_ma_kan.mp3",
    image_filename: "kafa_ya_nafsu_ma_kan.webp",
    moods: [],
    tags: ["nasheed", "soul", "reflection"],
  },
  {
    title_en: "Nabaratu Shiri Suttirat",
    audio_filename: "nabaratu_shiri_suttirat.mp3",
    image_filename: "nabaratu_shiri_suttirat.webp",
    moods: [],
    tags: ["nasheed", "poetry", "reflection"],
  },
  {
    title_en: "Nakmunu Jamia An Nas",
    audio_filename: "nakmunu_jamia_an_nas.mp3",
    image_filename: "nakmunu_jamia_an_nas.webp",
    moods: [],
    tags: ["nasheed", "strength", "unity"],
  },
  {
    title_en: "Qul Bi Rabbi Al Kawn",
    audio_filename: "qul_bi_rabbi_al_kawn.mp3",
    image_filename: "qul_bi_rabbi_al_kawn.webp",
    moods: [],
    tags: ["nasheed", "faith", "allah", "praise"],
  },
  {
    title_en: "Saati Shumukhan Saburan Anif",
    audio_filename: "saati_shumukhan_saburan_anif.mp3",
    image_filename: "saati_shumukhan_saburan_anif.webp",
    moods: [],
    tags: ["nasheed", "patience", "strength"],
  },
  {
    title_en: "Sanakhudu Maarikana Maahum",
    audio_filename: "sanakhudu_maarikana_maahum.mp3",
    image_filename: "sanakhudu_maarikana_maahum.webp",
    moods: [],
    tags: ["nasheed", "courage", "strength"],
  },
  {
    title_en: "Watanhal Kullu Humumi",
    audio_filename: "watanhal_kullu_humumi.mp3",
    image_filename: "watanhal_kullu_humumi.webp",
    moods: [],
    tags: ["nasheed", "hope", "relief"],
  },
  {
    title_en: "Watani",
    audio_filename: "watani.mp3",
    image_filename: "watani.webp",
    moods: ["calm"],
    tags: ["nasheed", "homeland"],
  },
  {
    title_en: "Who Is The One Exalted",
    audio_filename: "who_is_the_one_exalted.mp3",
    image_filename: "who_is_the_one_exalted.webp",
    moods: ["calm"],
    tags: ["nasheed", "faith", "praise"],
  },
  {
    title_en: "Ya Ghurbati",
    audio_filename: "ya_ghurbati.mp3",
    image_filename: "ya_ghurbati.webp",
    moods: [],
    tags: ["nasheed", "longing", "strangers"],
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
    const docId = `${DOC_PREFIX}_${String(i + 1).padStart(3, "0")}`;

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
