import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {admin} from "../lib/firebase";
import {getPlaybackLockId, getPlaybackScoreIncrement} from "../lib/scoring";

export const onReciterPlaybackCreated = onDocumentCreated(
  "reciter_plays/{playId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const data = snapshot.data();
    const reciterId = typeof data.reciterId === "string" ? data.reciterId : "";
    const surahId = typeof data.surahId === "string" ? data.surahId : "";
    const userId = typeof data.userId === "string" ? data.userId : "";
    const eventType = data.eventType;
    const scoreIncrement = getPlaybackScoreIncrement(eventType);

    if (!reciterId || !surahId || !userId || scoreIncrement === 0) {
      console.warn("Skipping reciter playback event with invalid payload", {
        playId: snapshot.id,
        reciterId,
        surahId,
        userId,
        eventType,
      });
      return;
    }

    const firestore = admin.firestore();
    const reciterRef = firestore.collection("reciters").doc(reciterId);
    const lockId = getPlaybackLockId({
      userId,
      reciterId,
      surahId,
      eventType,
      createdAt: data.createdAt,
    });
    const lockRef = firestore.collection("reciter_playback_locks").doc(lockId);

    await firestore.runTransaction(async (transaction) => {
      const lockSnapshot = await transaction.get(lockRef);
      if (lockSnapshot.exists) {
        return;
      }
      transaction.set(
        reciterRef,
        {
          popularity_score:
            admin.firestore.FieldValue.increment(scoreIncrement),
          play_count: admin.firestore.FieldValue.increment(
            eventType === "started" ? 1 : 0,
          ),
          qualified_play_count: admin.firestore.FieldValue.increment(
            eventType === "qualified" ? 1 : 0,
          ),
          completed_play_count: admin.firestore.FieldValue.increment(
            eventType === "completed" ? 1 : 0,
          ),
        },
        {merge: true},
      );
      transaction.set(lockRef, {
        playId: snapshot.id,
        reciterId,
        surahId,
        userId,
        eventType,
        createdAt:
          data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },
);
