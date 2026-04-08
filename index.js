globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import TrackPlayer from "react-native-track-player";
import { PlaybackService } from "./services/PlaybackService";

TrackPlayer.registerPlaybackService(() => PlaybackService);

import "expo-router/entry";
