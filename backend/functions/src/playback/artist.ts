import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {admin} from "../lib/firebase";
import {getPlaybackLockId, getPlaybackScoreIncrement} from "../lib/scoring";

/**
 * Aggregates an `artist_plays` event into both the artist document AND the
 * nasheed document. The same dedup lock guards both writes, so nasheed-level
 * metrics stay consistent with artist-level metrics (no double counting).
 */
export const onArtistPlaybackCreated = onDocumentCreated(
  "artist_plays/{playId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const data = snapshot.data();
    const artistId = typeof data.artistId === "string" ? data.artistId : "";
    const nasheedId = typeof data.nasheedId === "string" ? data.nasheedId : "";
    const userId = typeof data.userId === "string" ? data.userId : "";
    const eventType = data.eventType;
    const scoreIncrement = getPlaybackScoreIncrement(eventType);

    if (!artistId || !nasheedId || !userId || scoreIncrement === 0) {
      console.warn("Skipping artist playback event with invalid payload", {
        playId: snapshot.id,
        artistId,
        nasheedId,
        userId,
        eventType,
      });
      return;
    }

    const firestore = admin.firestore();
    const artistRef = firestore.collection("artists").doc(artistId);
    const nasheedRef = firestore.collection("nasheeds").doc(nasheedId);
    const lockId = getPlaybackLockId({
      userId,
      reciterId: artistId,
      surahId: nasheedId,
      eventType,
      createdAt: data.createdAt,
    });
    const lockRef = firestore.collection("artist_playback_locks").doc(lockId);

    const playCounters = {
      play_count: admin.firestore.FieldValue.increment(
        eventType === "started" ? 1 : 0,
      ),
      qualified_play_count: admin.firestore.FieldValue.increment(
        eventType === "qualified" ? 1 : 0,
      ),
      completed_play_count: admin.firestore.FieldValue.increment(
        eventType === "completed" ? 1 : 0,
      ),
    };
    const counterUpdate = {
      ...playCounters,
      popularity_score:
        admin.firestore.FieldValue.increment(scoreIncrement),
    };

    await firestore.runTransaction(async (transaction) => {
      const [lockSnapshot, artistSnapshot, nasheedSnapshot] =
        await Promise.all([
          transaction.get(lockRef),
          transaction.get(artistRef),
          transaction.get(nasheedRef),
        ]);
      if (lockSnapshot.exists) {
        return;
      }
      if (!artistSnapshot.exists || !nasheedSnapshot.exists) {
        console.warn(
          "Skipping artist playback event for unknown artist/nasheed",
          {
            playId: snapshot.id,
            artistId,
            nasheedId,
            artistExists: artistSnapshot.exists,
            nasheedExists: nasheedSnapshot.exists,
          },
        );
        return;
      }
      // Unlisted artists (the shared `unknown` artist, artists with only a
      // few nasheeds) never gain a popularity_score: the 1.1.0 app orders its
      // Popular rail by it without filtering on is_listed, so they would
      // show up there. Their nasheeds still score normally.
      const artistUpdate =
        artistSnapshot.get("is_listed") === false ?
          playCounters :
          counterUpdate;
      transaction.set(artistRef, artistUpdate, {merge: true});
      transaction.set(nasheedRef, counterUpdate, {merge: true});
      transaction.set(lockRef, {
        playId: snapshot.id,
        artistId,
        nasheedId,
        userId,
        eventType,
        createdAt:
          data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },
);
