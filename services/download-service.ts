import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp } from "@react-native-firebase/app";
import { getStorage, ref, getDownloadURL } from "@react-native-firebase/storage";

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
  const map = await getDownloads();
  map[record.trackId] = record;
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(map));
}

export async function deleteDownload(trackId: string): Promise<void> {
  const map = await getDownloads();
  const record = map[trackId];
  if (!record) return;
  try {
    await FileSystem.deleteAsync(record.localPath, { idempotent: true });
  } catch {}
  delete map[trackId];
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(map));
}

export async function getLocalPath(trackId: string): Promise<string | null> {
  const map = await getDownloads();
  const record = map[trackId];
  if (!record) return null;
  const info = await FileSystem.getInfoAsync(record.localPath);
  if (!info.exists) {
    delete map[trackId];
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(map));
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

  const storage = getStorage(getApp());
  const downloadUrl = await getDownloadURL(ref(storage, storagePath));

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
