import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { getApp } from "@react-native-firebase/app";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";

const CACHE_STORAGE_KEY = "@qasid-storage-url-cache";

// Bump to invalidate every persisted entry in a release (e.g. after a bulk
// Storage migration that regenerates download tokens).
const CACHE_SCHEMA_VERSION = 1;

// Firebase download URLs embed a `firebaseStorageDownloadTokens` value that is
// stable for the lifetime of the object — they do not expire on a clock. This
// TTL is hygiene (drop entries for content the user will never open again), not
// an expiry mechanism. Real invalidation is event-driven via
// `invalidateStorageUrl` from image/playback error handlers.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_CACHE_ENTRIES = 600;

// Matches the native per-host connection pool. Going higher just queues at the
// socket layer while making every in-flight request — including the one the
// user is waiting on — slower.
const MAX_CONCURRENT_RESOLUTIONS = 6;

const FLUSH_DEBOUNCE_MS = 1000;
const FLUSH_MAX_DELAY_MS = 5000;

// A pathologically slow AsyncStorage read on a low-end device must never block
// the first screen; we fall back to an empty (cold) cache instead.
const HYDRATION_TIMEOUT_MS = 1500;

interface CacheEntry {
  url: string;
  at: number;
}

interface PersistedCache {
  version: number;
  entries: Record<string, CacheEntry>;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string>>();

// Paths already invalidated once in this session. Without this, an offline
// session would let every image's onError wipe the whole cache.
const invalidatedThisSession = new Set<string>();

const isHttpUrl = (path: string): boolean => path.startsWith("http");

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

let isDirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushDeadline = 0;

// iOS can terminate a backgrounded app (0xdead10cc) if it holds a file lock
// across the suspension boundary, so writes only happen while foregrounded —
// plus exactly one flush as the app leaves the foreground. Same reasoning as
// the progress persistence in AudioPlayerContext.
let appState: AppStateStatus = AppState.currentState;

const evictIfOverCapacity = (): void => {
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return;
  const byAgeAscending = [...memoryCache.entries()].sort(
    (a, b) => a[1].at - b[1].at,
  );
  const excess = memoryCache.size - MAX_CACHE_ENTRIES;
  for (let i = 0; i < excess; i += 1) {
    memoryCache.delete(byAgeAscending[i][0]);
  }
};

const writeToDisk = async (): Promise<void> => {
  if (!isDirty) return;
  isDirty = false;
  evictIfOverCapacity();
  const payload: PersistedCache = {
    version: CACHE_SCHEMA_VERSION,
    entries: Object.fromEntries(memoryCache),
  };
  try {
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // A failed write only costs us the cache on next launch.
    isDirty = true;
  }
};

const cancelScheduledFlush = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushDeadline = 0;
};

const scheduleFlush = (): void => {
  isDirty = true;
  if (appState !== "active") return;

  const now = Date.now();
  if (flushTimer) {
    // Already scheduled; only push it back while under the hard ceiling so a
    // long scroll still persists rather than debouncing forever.
    if (now + FLUSH_DEBOUNCE_MS > flushDeadline) return;
    clearTimeout(flushTimer);
  } else {
    flushDeadline = now + FLUSH_MAX_DELAY_MS;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushDeadline = 0;
    void writeToDisk();
  }, FLUSH_DEBOUNCE_MS);
};

AppState.addEventListener("change", (next) => {
  const wasActive = appState === "active";
  appState = next;
  if (wasActive && next !== "active") {
    cancelScheduledFlush();
    void writeToDisk();
  } else if (!wasActive && next === "active" && isDirty) {
    scheduleFlush();
  }
});

/* -------------------------------------------------------------------------- */
/* Hydration                                                                   */
/* -------------------------------------------------------------------------- */

const readFromDisk = async (): Promise<void> => {
  const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
  if (!raw) return;

  const parsed = JSON.parse(raw) as Partial<PersistedCache>;
  if (parsed.version !== CACHE_SCHEMA_VERSION || !parsed.entries) return;

  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [path, entry] of Object.entries(parsed.entries)) {
    if (entry && typeof entry.url === "string" && entry.at > cutoff) {
      memoryCache.set(path, entry);
    }
  }
  evictIfOverCapacity();
};

const hydrationPromise: Promise<void> = Promise.race([
  readFromDisk().catch(() => undefined),
  new Promise<void>((resolve) => setTimeout(resolve, HYDRATION_TIMEOUT_MS)),
]);

/**
 * Idempotent hydration kick. Resolvers await hydration internally, so calling
 * this is optional — but doing it at app start overlaps the disk read with boot
 * instead of paying for it on the first screen.
 */
export const hydrateStorageUrlCache = (): Promise<void> => hydrationPromise;

/* -------------------------------------------------------------------------- */
/* Concurrency                                                                 */
/* -------------------------------------------------------------------------- */

type Release = () => void;

let activeResolutions = 0;
const waiting: ((release: Release) => void)[] = [];

const releaseSlot = (): void => {
  const next = waiting.shift();
  if (next) {
    next(releaseSlot);
    return;
  }
  activeResolutions -= 1;
};

const acquireSlot = (priority: boolean): Promise<Release> => {
  if (priority || activeResolutions < MAX_CONCURRENT_RESOLUTIONS) {
    activeResolutions += 1;
    return Promise.resolve(releaseSlot);
  }
  return new Promise<Release>((resolve) => {
    waiting.push(resolve);
  });
};

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

const fetchDownloadUrl = async (
  path: string,
  priority: boolean,
): Promise<string> => {
  const release = await acquireSlot(priority);
  try {
    return await getDownloadURL(ref(getStorage(getApp()), path));
  } finally {
    release();
  }
};

const resolveThroughCache = async (
  path: string,
  priority: boolean,
): Promise<string> => {
  await hydrationPromise;

  const cached = memoryCache.get(path);
  if (cached) {
    // Touch so approximate-LRU eviction keeps what is actually in use.
    cached.at = Date.now();
    return cached.url;
  }

  const pending = inFlight.get(path);
  if (pending) return pending;

  const request = fetchDownloadUrl(path, priority)
    .then((url) => {
      memoryCache.set(path, { url, at: Date.now() });
      scheduleFlush();
      return url;
    })
    .finally(() => {
      // Dropped on both paths so a transient failure retries on the next call
      // instead of leaving a permanently rejected promise behind.
      inFlight.delete(path);
    });

  inFlight.set(path, request);
  return request;
};

/**
 * Resolves a Firebase Storage path to a download URL, throwing if it cannot be
 * resolved. Only successful results are cached. Use this wherever a raw path is
 * useless to the caller — audio handed to the player, for instance.
 */
export const resolveStorageUrlStrict = async (
  path: string,
): Promise<string> => {
  if (isHttpUrl(path)) return path;
  return resolveThroughCache(path, false);
};

/**
 * Same, but jumps the concurrency queue. Reserved for user-initiated work (a
 * play tap) that must not wait behind a backlog of background image requests.
 */
export const resolveStorageUrlPrioritized = async (
  path: string,
): Promise<string> => {
  if (isHttpUrl(path)) return path;
  return resolveThroughCache(path, true);
};

/**
 * Resolves a Firebase Storage path to a download URL. Pass-through for values
 * that are already HTTP(S) URLs, and best-effort fallback to the raw path.
 *
 * The fallback is deliberately computed per call and never cached — caching it
 * would pin a value that can never load.
 */
export const resolveStorageUrl = async (path: string): Promise<string> => {
  if (!path) return "";
  try {
    return await resolveStorageUrlStrict(path);
  } catch {
    return path;
  }
};

export const resolveOptionalStorageUrl = async (
  path?: string | null,
): Promise<string | null> => (path ? resolveStorageUrl(path) : null);

/**
 * Synchronous peek at the in-memory cache. Lets callers seed initial state
 * without a render pass — a revisited screen shows its artwork on the first
 * frame instead of flashing placeholders.
 */
export const peekStorageUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (isHttpUrl(path)) return path;
  return memoryCache.get(path)?.url;
};

/**
 * Drops one entry so the next resolution hits the network. Called when a URL
 * demonstrably failed to load (replaced object, revoked token).
 *
 * Capped at once per path per session: offline, every image reports an error,
 * and without the cap a single offline session would wipe the whole cache.
 */
export const invalidateStorageUrl = (path?: string | null): void => {
  if (!path || isHttpUrl(path)) return;
  if (invalidatedThisSession.has(path)) return;
  invalidatedThisSession.add(path);
  if (memoryCache.delete(path)) scheduleFlush();
};
