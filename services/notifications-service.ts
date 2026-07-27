import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, PermissionsAndroid } from "react-native";
import { getApp } from "@react-native-firebase/app";
import {
  getMessaging,
  requestPermission,
  subscribeToTopic,
  unsubscribeFromTopic,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";
import { useEffect, useReducer } from "react";

const STORAGE_KEY = "@qasid-notification-prefs";
const NEW_CONTENT_TOPIC = "new-content";

// Module-level singleton so all hook instances (Settings screen, launch wiring) share one state.
let _subscribed = false;
let _hydrated = false;
const _listeners = new Set<() => void>();

async function persist(subscribed: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ subscribed }));
}

async function requestOsPermission(): Promise<boolean> {
  if (Platform.OS === "android" && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
  }

  const authStatus = await requestPermission(getMessaging(getApp()));
  return (
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL
  );
}

export async function setSubscribed(next: boolean): Promise<void> {
  if (next) {
    const granted = await requestOsPermission();
    if (!granted) {
      _subscribed = false;
      await persist(false);
      _listeners.forEach((fn) => fn());
      return;
    }
    await subscribeToTopic(getMessaging(getApp()), NEW_CONTENT_TOPIC);
  } else {
    await unsubscribeFromTopic(getMessaging(getApp()), NEW_CONTENT_TOPIC);
  }

  _subscribed = next;
  await persist(next);
  _listeners.forEach((fn) => fn());
}

// Called once on first successful login — opt-out default, so we try to
// subscribe automatically and silently stay unsubscribed if permission is denied.
export async function requestPermissionAndSubscribe(): Promise<void> {
  await setSubscribed(true);
}

export async function hydrateAndSyncSubscription(): Promise<void> {
  if (_hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _hydrated = true;
      _listeners.forEach((fn) => fn());
      await requestPermissionAndSubscribe();
      return;
    }

    const data = JSON.parse(raw) as { subscribed: boolean };
    _subscribed = data.subscribed;
    if (data.subscribed) {
      await subscribeToTopic(getMessaging(getApp()), NEW_CONTENT_TOPIC);
    }
  } catch (error) {
    // Non-fatal — treat as unsubscribed, but surface it so a real failure
    // (vs. simply never having subscribed) isn't invisible.
    console.error("hydrateAndSyncSubscription failed:", error);
  }
  _hydrated = true;
  _listeners.forEach((fn) => fn());
}

export function useNotificationPrefs() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(rerender);
    void hydrateAndSyncSubscription();
    return () => {
      _listeners.delete(rerender);
    };
  }, []);

  return {
    subscribed: _subscribed,
    hydrated: _hydrated,
    setSubscribed,
  };
}
