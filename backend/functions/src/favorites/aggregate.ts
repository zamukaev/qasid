import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {admin} from "../lib/firebase";

// Maintains nasheeds/{id}.favorite_count as users favorite/unfavorite. Clients
// cannot write the nasheeds collection directly, so this runs server-side.
export const onFavoriteWritten = onDocumentWritten(
  "user_favorites/{userId}/nasheeds/{nasheedId}",
  async (event) => {
    const existedBefore = event.data?.before.exists ?? false;
    const existsAfter = event.data?.after.exists ?? false;

    // Only create (+1) and delete (-1) change the count; updates don't.
    if (existedBefore === existsAfter) return;

    const nasheedId = event.params.nasheedId;
    const delta = existsAfter ? 1 : -1;

    await admin
      .firestore()
      .collection("nasheeds")
      .doc(nasheedId)
      .set(
        {favorite_count: admin.firestore.FieldValue.increment(delta)},
        {merge: true},
      );
  },
);
