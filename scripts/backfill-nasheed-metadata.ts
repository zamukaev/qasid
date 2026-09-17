/**
 * Backfill script: ensure every `nasheeds` doc has the fields the
 * recommendations backend depends on (`moods` + counter scores).
 *
 * Why this exists:
 *   - weeklyMix.ts / playlists.ts read `moods` and order by `popularity_score`.
 *   - Firestore `orderBy("popularity_score")` SILENTLY EXCLUDES docs that lack
 *     the field, so any nasheed without it is invisible to every recommendation
 *     query. Docs without `moods` never appear in mood playlists.
 *
 * Modes:
 *   audit (default) — read-only report of what's missing, grouped by artist.
 *   apply (--apply) — idempotent, non-destructive writes:
 *     * counters set to 0 ONLY when the field is absent (never overwrites
 *       accumulated production metrics);
 *     * `moods` written ONLY for doc ids present in MOOD_MAP below. Uncurated
 *       docs are left untouched and reported (so curation isn't masked).
 *
 * Usage:
 *   npm run backfill:nasheeds            # audit
 *   npm run backfill:nasheeds -- --apply # apply
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Keep in sync with Mood in types/nasheed.ts
type Mood = "calm" | "motivational" | "sleep" | "focus";

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "❌  Service account key not found at scripts/serviceAccountKey.json\n" +
      "    Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "qasid-fd80d",
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Curated moods, keyed by nasheed doc id. Add entries here for any doc the
// audit reports as missing moods, then re-run with --apply.
// ---------------------------------------------------------------------------

// Curations below are best-effort from each track's title — adjust freely.
const MOOD_MAP: Record<string, Mood[]> = {
  // Ahmed Bukhatir (seeded by scripts/seed-nasheeds-abu-ali.ts, no moods)
  ahmed_bukhatir_001: ["calm", "focus"], // Ya Adheeman
  ahmed_bukhatir_002: ["focus", "motivational"], // Al Hejaab
  ahmed_bukhatir_003: ["focus", "calm"], // Daar Aa Ghoroor
  ahmed_bukhatir_004: ["motivational"], // Fartaqi
  ahmed_bukhatir_005: ["calm", "motivational"], // Fartaqi Ya Eid
  ahmed_bukhatir_006: ["calm", "focus"], // Ketaab Allah
  ahmed_bukhatir_007: ["motivational", "focus"], // Taaleb Al Elm
  ahmed_bukhatir_008: ["calm", "focus"], // Ya Man Yara

  // Mishary Alafasy
  alafasy_001: ["calm", "focus"], // Marra Yawmi
  alafasy_002: ["motivational"], // Ash-Sham
  alafasy_003: ["focus"], // Ya Man Yadda‘i Al-Fahm
  alafasy_004: ["calm"], // Tala Al Badru Alayna
  alafasy_005: ["calm", "focus"], // La ilaha illa Allah (dhikr)

  // Muhammad al-Muqit
  muhammad_al_muqit_001: ["focus"], // Al-Tawdih
  muhammad_al_muqit_002: ["motivational"], // Asmu
  muhammad_al_muqit_003: ["motivational"], // Al-Infijar
  muhammad_al_muqit_004: ["calm"], // Fi Al-Qalb
  muhammad_al_muqit_005: ["calm", "focus"], // Laka Ya Rabbi (dua)
  muhammad_al_muqit_006: ["calm"], // Huna Qalban Mafakhir Wa Maghani
  muhammad_al_muqit_007: ["motivational"], // Al-Watan
  muhammad_al_muqit_008: ["focus"], // Hurufi
  muhammad_al_muqit_009: ["motivational"], // Ana Muqawim
  muhammad_al_muqit_010: ["motivational"], // Artaqi
  muhammad_al_muqit_011: ["motivational", "focus"], // Waqaftu Khitabi
  muhammad_al_muqit_012: ["calm"], // Al-Wafa
  muhammad_al_muqit_013: ["calm", "focus"], // Min Ni'amillahi Jabbari
  muhammad_al_muqit_014: ["motivational"], // Jibal Al-Ukhuwwah
  muhammad_al_muqit_015: ["sleep", "calm"], // Mawlaya Qad Namat Al-'Uyun
  muhammad_al_muqit_016: ["calm", "focus"], // Musalla
  muhammad_al_muqit_017: ["motivational", "focus"], // Lughati Al-'Arabiyyah
  muhammad_al_muqit_018: ["calm", "sleep"], // Ya Habibi Al-Saghir
  muhammad_al_muqit_019: ["calm", "motivational"], // Hulmi
  muhammad_al_muqit_020: ["motivational"], // Amali
  muhammad_al_muqit_021: ["calm"], // Hubbi Laka
  muhammad_al_muqit_022: ["calm"], // Ummi Kam Uhibbuha
  muhammad_al_muqit_023: ["motivational"], // Nas'a Li-Nutawwir Khutuwatina
  muhammad_al_muqit_024: ["motivational"], // Shaheed
  muhammad_al_muqit_025: ["motivational"], // Junud Allah
  muhammad_al_muqit_026: ["calm"], // Jamal Al-Wujud
  muhammad_al_muqit_027: ["motivational"], // Al-Sumayyah
  muhammad_al_muqit_028: ["focus"], // Al-Tariq Al-Mustaqim
  muhammad_al_muqit_029: ["focus", "calm"], // Al-Dhunub
  muhammad_al_muqit_030: ["motivational"], // Ruh Al-Shaja'ah
  muhammad_al_muqit_031: ["calm"], // Tariq Al-Dumu'
  muhammad_al_muqit_032: ["calm"], // Al-Dif'
  muhammad_al_muqit_033: ["calm"], // Zafaf
  muhammad_al_muqit_034: ["calm"], // Zafaf
  muhammad_al_muqit_035: ["calm"], // Zafaf
  muhammad_al_muqit_036: ["calm", "motivational"], // Ahlan Wa Sahlan
  muhammad_al_muqit_037: ["sleep", "calm"], // Ma'a Al-Qamar
  muhammad_al_muqit_038: ["motivational"], // Ya Ansar Al-Huda
  muhammad_al_muqit_039: ["motivational"], // Ya Ansar Al-Huda
};

// Counter fields the recommendations/playback code expects to exist.
const COUNTER_FIELDS = [
  "popularity_score",
  "trending_score",
  "play_count",
  "qualified_play_count",
  "completed_play_count",
  "favorite_count",
] as const;

const BATCH_CHUNK = 400; // < Firestore 500-write batch limit

interface DocReport {
  id: string;
  artist_id: string;
  missingMoods: boolean;
  missingCounters: string[];
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const snap = await db.collection("nasheeds").get();
  console.log(`\nScanned ${snap.size} nasheeds docs.\n`);

  const reports: DocReport[] = [];
  // Pending field writes per doc id (apply mode only).
  const pending = new Map<string, Record<string, unknown>>();

  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    const artist_id = String(data.artist_id ?? "(unknown)");

    const missingCounters = COUNTER_FIELDS.filter(
      (f) => data[f] === undefined,
    );
    const hasMoods = Array.isArray(data.moods) && data.moods.length > 0;
    const curated = MOOD_MAP[id];
    const missingMoods = !hasMoods;

    if (missingCounters.length || missingMoods) {
      reports.push({ id, artist_id, missingMoods, missingCounters });
    }

    if (!apply) continue;

    const update: Record<string, unknown> = {};
    for (const f of missingCounters) update[f] = 0;
    if (missingMoods && curated) update.moods = curated;
    if (Object.keys(update).length) pending.set(id, update);
  }

  // ---- Report, grouped by artist ----
  const byArtist = new Map<string, DocReport[]>();
  for (const r of reports) {
    const list = byArtist.get(r.artist_id) ?? [];
    list.push(r);
    byArtist.set(r.artist_id, list);
  }

  if (!reports.length) {
    console.log("✓  All docs already have moods + counters. Nothing to do.\n");
  } else {
    console.log("Docs needing attention:\n");
    for (const [artist, list] of byArtist) {
      console.log(`  ${artist}  (${list.length})`);
      for (const r of list) {
        const bits: string[] = [];
        if (r.missingMoods) {
          bits.push(MOOD_MAP[r.id] ? "moods←curated" : "moods MISSING (uncurated)");
        }
        if (r.missingCounters.length) bits.push(`counters: ${r.missingCounters.join(",")}`);
        console.log(`    - ${r.id}: ${bits.join("; ")}`);
      }
    }
    console.log("");
  }

  const uncurated = reports.filter((r) => r.missingMoods && !MOOD_MAP[r.id]);
  if (uncurated.length) {
    console.log(
      `⚠️  ${uncurated.length} doc(s) lack moods and are not in MOOD_MAP — ` +
        "add them to MOOD_MAP, then re-run with --apply:\n  " +
        uncurated.map((r) => r.id).join("\n  ") +
        "\n",
    );
  }

  if (!apply) {
    console.log("Audit only. Re-run with --apply to write changes.\n");
    return;
  }

  // ---- Apply in batches ----
  if (!pending.size) {
    console.log("Nothing to write.\n");
    return;
  }

  const entries = [...pending.entries()];
  let written = 0;
  for (let i = 0; i < entries.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const [id, update] of entries.slice(i, i + BATCH_CHUNK)) {
      batch.set(db.collection("nasheeds").doc(id), update, { merge: true });
    }
    await batch.commit();
    written += Math.min(BATCH_CHUNK, entries.length - i);
    console.log(`  committed ${written}/${entries.length}`);
  }
  console.log(`\n✓  Applied updates to ${entries.length} doc(s).\n`);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
