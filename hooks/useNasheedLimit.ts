import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useReducer } from "react";

const STORAGE_KEY = "@qasid-nasheed-limit";
const FREE_DAILY_LIMIT = 5;

// Module-level singleton so all hook instances and the layout guard share the same count.
let _count = 0;
let _date = "";
let _hydrated = false;
let _manualPlayPending = false;
const _listeners = new Set<() => void>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay(): void {
  if (!_hydrated) return;
  if (_date !== today()) {
    _count = 0;
    _date = today();
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ count: 0, date: _date }),
    );
  }
}

async function hydrate(): Promise<void> {
  if (_hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _date = today();
    } else {
      const data = JSON.parse(raw) as { count: number; date: string };
      if (data.date === today()) {
        _count = data.count;
        _date = data.date;
      } else {
        _count = 0;
        _date = today();
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ count: 0, date: _date }),
        );
      }
    }
  } catch {}
  _hydrated = true;
  _listeners.forEach((fn) => fn());
}

// Called by handlePlayNasheed before playTrack() — tells the layout guard to skip
// this track change since the screen already called increment().
export function markManualPlay(): void {
  _manualPlayPending = true;
}

export function consumeManualPlayFlag(): boolean {
  const was = _manualPlayPending;
  _manualPlayPending = false;
  return was;
}

export async function incrementNasheedCount(): Promise<void> {
  resetIfNewDay();
  _count++;
  _listeners.forEach((fn) => fn());
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ count: _count, date: _date }),
  );
}

export function checkCanPlay(isPremium: boolean): boolean {
  resetIfNewDay();
  return isPremium || _count < FREE_DAILY_LIMIT;
}

export function useNasheedLimit() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(rerender);
    void hydrate();
    return () => {
      _listeners.delete(rerender);
    };
  }, []);

  resetIfNewDay();

  return {
    canPlay: (isPremium: boolean) => isPremium || _count < FREE_DAILY_LIMIT,
    increment: incrementNasheedCount,
    playsLeft: Math.max(0, FREE_DAILY_LIMIT - _count),
  };
}
