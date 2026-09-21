import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveStorageUrlStrict } from "./storage";

const DOWNLOADS_KEY = "@qasid-downloads";
const DOWNLOAD_DIR = FileSystem.documentDirectory + "qasid-downloads/";

export type DownloadRecord = {
  trackId: string;
  storagePath: string;
  localPath: string;
  title: string;
  artist?: string;
  isNasheed: boolean;
  downloadedAt: number;
};

type DownloadMap = Record<string, DownloadRecord>;

// Every mutation reads the whole map and writes it back, so two of them in
// flight at once lose each other's entry. Downloading a collection runs several
// transfers in parallel, so they queue up here instead.
let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(mutate: () => Promise<T>): Promise<T> {
  const run = writeChain.then(mutate, mutate);
  // A rejected mutation must not break the chain for the ones behind it.
  writeChain = run.catch(() => {});
  return run;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

function extractStoragePath(uri: any): string | null {
  const raw = typeof uri === "object" && uri?.uri !== undefined ? uri.uri : uri;
  if (typeof raw !== "string") return null;
  if (raw.startsWith("http") || raw.startsWith("file")) return null;
  return raw;
}

export async function getDownloads(): Promise<DownloadMap> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveDownload(record: DownloadRecord): Promise<void> {
  await serialize(async () => {
    const map = await getDownloads();
    map[record.trackId] = record;
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(map));
  });
}

export async function deleteDownload(trackId: string): Promise<void> {
  await serialize(async () => {
    const map = await getDownloads();
    const record = map[trackId];
    if (!record) return;
    try {
      await FileSystem.deleteAsync(record.localPath, { idempotent: true });
    } catch {}
    delete map[trackId];
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(map));
  });
}

/**
 * Which of these tracks are recorded as downloaded. Only reads the map — unlike
 * `getLocalPath` it does not stat every file, which for a reciter would be 114
 * filesystem round-trips just to render one icon.
 */
export async function getDownloadedIds(
  trackIds: readonly string[],
): Promise<Set<string>> {
  const map = await getDownloads();
  return new Set(trackIds.filter((id) => map[id] != null));
}

export async function getLocalPath(trackId: string): Promise<string | null> {
  const map = await getDownloads();
  const record = map[trackId];
  if (!record) return null;
  const info = await FileSystem.getInfoAsync(record.localPath);
  if (!info.exists) {
    // Re-read inside the chain: `map` was fetched before the await above and
    // another mutation may have landed in the meantime.
    await serialize(async () => {
      const latest = await getDownloads();
      delete latest[trackId];
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(latest));
    });
    return null;
  }
  return record.localPath;
}

export async function downloadTrack(
  track: {
    id: string;
    uri: any;
    title: string;
    artist?: string;
    isNasheed?: boolean;
  },
  onProgress?: (progress: number) => void,
): Promise<string> {
  await ensureDir();

  const storagePath = extractStoragePath(track.uri);
  if (!storagePath) {
    throw new Error("Track has no Firebase Storage path to download");
  }

  const downloadUrl = await resolveStorageUrlStrict(storagePath);

  const safeId = track.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const localPath = DOWNLOAD_DIR + safeId + ".mp3";

  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    localPath,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0 && onProgress) {
        onProgress(totalBytesWritten / totalBytesExpectedToWrite);
      }
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) throw new Error("Download failed");

  await saveDownload({
    trackId: track.id,
    storagePath,
    localPath: result.uri,
    title: track.title,
    artist: track.artist,
    isNasheed: track.isNasheed ?? false,
    downloadedAt: Date.now(),
  });

  return result.uri;
}

export async function getTotalDownloadSizeBytes(): Promise<number> {
  const map = await getDownloads();
  let total = 0;
  await Promise.all(
    Object.values(map).map(async (record) => {
      try {
        const info = await FileSystem.getInfoAsync(record.localPath, {
          size: true,
        });
        if (info.exists && "size" in info) {
          total += info.size as number;
        }
      } catch {}
    }),
  );
  return total;
}
