import TrackPlayer, { Event } from "react-native-track-player";

/**
 * PlaybackService runs as a HeadlessJS task on Android (separate JS context).
 * It MUST use only TrackPlayer API directly — no DeviceEventEmitter, no React state,
 * no module-level singletons shared with the main app context.
 *
 * The full track queue is loaded into RNTP by AudioPlayerContext, so
 * skipToNext / skipToPrevious work natively without any bridge.
 */
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    await TrackPlayer.seekTo(event.position);
  });

  // These work because AudioPlayerContext loads the FULL queue into RNTP.
  // Pressing Next/Previous on the lock screen or via Bluetooth will skip
  // within the native queue and fire PlaybackActiveTrackChanged, which
  // AudioPlayerContext listens to for UI sync.
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    await TrackPlayer.skipToNext();
    await TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    await TrackPlayer.skipToPrevious();
    await TrackPlayer.play();
  });
}
