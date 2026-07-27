globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import TrackPlayer from "react-native-track-player";
import { PlaybackService } from "./services/PlaybackService";
import { getApp } from "@react-native-firebase/app";
import {
  getMessaging,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";

TrackPlayer.registerPlaybackService(() => PlaybackService);

// RNFB requires a background handler to be registered; FCM auto-displays
// `notification` payloads in the system tray when backgrounded/killed, so
// this is a no-op that just satisfies that requirement.
setBackgroundMessageHandler(getMessaging(getApp()), async () => {});

import "expo-router/entry";
