/**
 * Set Nasheed Years — write `year` on nasheeds from a JSON file
 *
 * The years drive era collections ("Retro", "Nasheeds of 2025"). The file is
 * an array of { id, artist, title, year }, where year is a number or null
 * (null clears it); artist and title are only there to make it readable.
 *
 * Usage:
 *   npm run years:set -- --export             — write every nasheed, with its
 *                                               current year, to the file
 *   npm run years:set -- --dry-run            — show what would change
 *   npm run years:set                         — write the changes
 *   npm run years:set -- --file other.json    — use another file
 *
 * Default file: scripts/collections/nasheed-years.json. Only nasheeds whose
 * year differs are written; an unknown id aborts the run before any write.
 * Run `npm run collections:build` afterwards to refresh the collections.
 * The 1.1.0 app ignores `year`.
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import { NasheedYearEntry, parseNasheedYears } from "../utils/collections";

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");
const DEFAULT_FILE = path.resolve(__dirname, "collections/nasheed-years.json");
const MAX_BATCH_WRITES = 400;

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const filePath =
  fileIdx !== -1 && args[fileIdx + 1] ? path.resolve(args[fileIdx + 1]) : DEFAULT_FILE;
const exportMode = args.includes("--export");
const dryRun = args.includes("--dry-run");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "Service account key not found at scripts/serviceAccountKey.json\n" +
      "Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")) as admin.ServiceAccount,
  ),
  projectId: "qasid-fd80d",
});

const db = admin.firestore();

// ---------------------------------------------------------------------------

const currentYear = (data: admin.firestore.DocumentData): number | null =>
  typeof data.year === "number" ? data.year : null;

async function exportYears(
  docs: admin.firestore.QueryDocumentSnapshot[],
): Promise<void> {
  if (fs.existsSync(filePath) && !args.includes("--force")) {
    console.error(
      `${path.relative(process.cwd(), filePath)} already exists; pass --force to overwrite it.`,
    );
    process.exit(1);
  }
  const entries: NasheedYearEntry[] = docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        artist: typeof data.name_en === "string" ? data.name_en.trim() : "",
        title: typeof data.title_en === "string" ? data.title_en.trim() : "",
        year: currentYear(data),
      };
    })
    .sort(
      (a, b) =>
        (a.artist ?? "").localeCompare(b.artist ?? "") ||
        (a.title ?? "").localeCompare(b.title ?? ""),
    );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(entries, null, 2)}\n`);
  const withYear = entries.filter((e) => e.year !== null).length;
  console.log(
    `Wrote ${entries.length} nasheeds (${withYear} with a year) to ${path.relative(process.cwd(), filePath)}.`,
  );
}

async function applyYears(
  docs: admin.firestore.QueryDocumentSnapshot[],
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.error(
      `${path.relative(process.cwd(), filePath)} not found. Create it with --export first.`,
    );
    process.exit(1);
  }
  const parsed = parseNasheedYears(JSON.parse(fs.readFileSync(filePath, "utf8")));
  if (!parsed.ok) {
    console.error(`Invalid ${path.relative(process.cwd(), filePath)}:`);
    parsed.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const byId = new Map(docs.map((d) => [d.id, d]));
  const unknown = [...parsed.value.keys()].filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    console.error(`Unknown nasheed ids, nothing written: ${unknown.join(", ")}`);
    process.exit(1);
  }

  const changes = [...parsed.value]
    .map(([id, year]) => ({ doc: byId.get(id)!, year }))
    .filter(({ doc, year }) => currentYear(doc.data()) !== year);

  for (const { doc, year } of changes) {
    const from = currentYear(doc.data());
    console.log(`  ${doc.id}: ${from ?? "—"} → ${year ?? "—"}  (${doc.data().title_en ?? ""})`);
  }
  if (changes.length === 0) {
    console.log("Nothing to change.");
    return;
  }
  if (dryRun) {
    console.log(`\nDry run: ${changes.length} change(s) skipped.`);
    return;
  }

  for (let i = 0; i < changes.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    for (const { doc, year } of changes.slice(i, i + MAX_BATCH_WRITES)) {
      batch.update(doc.ref, {
        year: year ?? admin.firestore.FieldValue.delete(),
      });
    }
    await batch.commit();
  }
  console.log(
    `\nDone: ${changes.length} nasheed(s) updated. Run npm run collections:build to refresh the collections.`,
  );
}

async function main(): Promise<void> {
  const snapshot = await db.collection("nasheeds").get();
  if (exportMode) {
    await exportYears(snapshot.docs);
  } else {
    await applyYears(snapshot.docs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
