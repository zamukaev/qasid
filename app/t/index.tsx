import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { GOLD } from "../../constants/colors";
import {
  SHARE_PARAM_NASHEED,
  SHARE_PARAM_RECITER,
  SHARE_PARAM_SURAH,
} from "../../constants/links";
import { useAudioPlayer } from "../../context/AudioPlayerContext";
import { useAuth } from "../../hooks/useAuth";
import { checkCanPlay, markManualPlay } from "../../hooks/useNasheedLimit";
import { fetchNasheedsByIds } from "../../services/nasheeds-service";
import {
  fetchReciterById,
  fetchSurahByNumber,
} from "../../services/quran-service";
import {
  resolveOptionalStorageUrl,
  resolveStorageUrlPrioritized,
} from "../../services/storage";
import { useIsPremium } from "../../stores/userStore";
import { setPendingShare } from "../../utils/pendingShare";

/**
 * Landing route for a shared Universal/App Link
 * (`https://qasid-sound.com/t/?n=…` or `?r=…&s=…`).
 *
 * It resolves the track, starts it, and then replaces itself with the screen
 * the track lives on, so Back never returns to this loader.
 *
 * Playback happens here rather than on the destination screen because those
 * screens page their lists — a shared nasheed can sit on page four of an
 * artist, and a shared surah past the first twenty of a reciter.
 */
export default function ShareTargetScreen() {
  const params = useLocalSearchParams<{
    [SHARE_PARAM_NASHEED]?: string;
    [SHARE_PARAM_RECITER]?: string;
    [SHARE_PARAM_SURAH]?: string;
  }>();
  const router = useRouter();
  const { user, emailVerified, loading } = useAuth();
  const isPremium = useIsPremium();
  const { playTrack, setQueue } = useAudioPlayer();

  const [error, setError] = useState<string | null>(null);
  // Params survive a re-render, so without this a slow resolve could run twice.
  const startedRef = useRef(false);

  const nasheedId = params[SHARE_PARAM_NASHEED];
  const reciterId = params[SHARE_PARAM_RECITER];
  const surahParam = params[SHARE_PARAM_SURAH];

  const openNasheed = useCallback(
    async (id: string) => {
      const nasheeds = await fetchNasheedsByIds([id]);
      const nasheed = nasheeds.get(id);
      if (!nasheed) throw new Error("not-found");

      const artistRoute = {
        pathname: "/(tabs)/nasheeds/artist/[id]" as const,
        params: { id: nasheed.artist_id },
      };

      // Over the daily limit: land on the artist anyway. Tapping the row there
      // raises the existing PremiumGateModal, so the gate is not duplicated.
      if (!checkCanPlay(isPremium)) {
        router.replace(artistRoute);
        return;
      }

      const audioUrl = await resolveStorageUrlPrioritized(nasheed.audio_path);
      const artworkUri = await resolveOptionalStorageUrl(nasheed.image_path);
      // Matches the id the artist screen builds, so its row shows as playing.
      const trackId = `${nasheed.artist_id}-${nasheed.id}`;
      const track = {
        id: trackId,
        title: nasheed.title_en,
        artist: nasheed.name_en,
        artworkUri,
        isNasheed: true,
        uri: { uri: audioUrl },
      };

      // A queue of one: the artist screen rebuilds the full queue as soon as
      // anything there is tapped.
      setQueue([track]);
      markManualPlay();
      await playTrack(track);
      router.replace(artistRoute);
    },
    [isPremium, playTrack, setQueue, router],
  );

  const openSurah = useCallback(
    async (reciter: string, surahNumber: number) => {
      // In parallel: the reciter is only needed for the name shown on the
      // lock screen, so it must not add a round trip before playback.
      const [surah, reciterDoc] = await Promise.all([
        fetchSurahByNumber(reciter, surahNumber),
        fetchReciterById(reciter).catch(() => null),
      ]);
      if (!surah) throw new Error("not-found");

      const audioUrl = await resolveStorageUrlPrioritized(surah.audio_path);
      const track = {
        // Matches the id the reciter screen builds, so its row shows as playing.
        id: `${reciter}-${surah.id}`,
        surahNumber: surah.surah_number,
        title: surah.name_en,
        artist: reciterDoc?.name_en ?? surah.name_ar,
        // Already a download URL — fetchSurahByNumber resolves it.
        artworkUri: surah.image_path,
        uri: { uri: audioUrl },
      };

      setQueue([track]);
      await playTrack(track);
      router.replace({
        pathname: "/(tabs)/quran/reciter/[id]",
        params: { id: reciter },
      });
    },
    [playTrack, setQueue, router],
  );

  useEffect(() => {
    if (loading || startedRef.current) return;

    const surahNumber = surahParam ? Number(surahParam) : NaN;
    const hasNasheed = !!nasheedId;
    const hasSurah = !!reciterId && Number.isFinite(surahNumber);

    if (!hasNasheed && !hasSurah) {
      setError("This link is not valid.");
      return;
    }

    // Signed out, or still behind the verification wall: stash the link and let
    // the gate in app/index.tsx replay it once the user is through.
    if (!user || !emailVerified) {
      setPendingShare(
        hasNasheed
          ? `/t?${SHARE_PARAM_NASHEED}=${encodeURIComponent(nasheedId)}`
          : `/t?${SHARE_PARAM_RECITER}=${encodeURIComponent(reciterId!)}` +
              `&${SHARE_PARAM_SURAH}=${surahNumber}`,
      );
      router.replace("/");
      return;
    }

    startedRef.current = true;
    const run = hasNasheed
      ? openNasheed(nasheedId)
      : openSurah(reciterId!, surahNumber);

    run.catch((e) => {
      console.error("Share link failed", e);
      startedRef.current = false;
      setError(
        e instanceof Error && e.message === "not-found"
          ? "This track is no longer available."
          : "Could not open this link. Check your connection and try again.",
      );
    });
  }, [
    loading,
    user,
    emailVerified,
    nasheedId,
    reciterId,
    surahParam,
    openNasheed,
    openSurah,
    router,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <View className="flex-1 items-center justify-center px-8">
        {error ? (
          <>
            <Text className="text-qasid-white/70 text-base text-center">
              {error}
            </Text>
            <Text
              onPress={() => router.replace("/(tabs)/quran")}
              className="text-qasid-gold text-base mt-4"
            >
              Go to QASID
            </Text>
          </>
        ) : (
          <ActivityIndicator size="large" color={GOLD} />
        )}
      </View>
    </SafeAreaView>
  );
}
