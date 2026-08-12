import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {admin} from "../lib/firebase";

const NEW_CONTENT_TOPIC = "new-content";

export const onReciterCreated = onDocumentCreated(
  "reciters/{reciterId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.is_active === false) {
      return;
    }

    const name =
      typeof data.name_en === "string" ? data.name_en : "A new reciter";

    await admin.messaging().send({
      topic: NEW_CONTENT_TOPIC,
      notification: {
        title: "New Reciter Added",
        body: `${name} is now available on QASID`,
      },
      data: {type: "reciter", id: event.params.reciterId},
      apns: {
        payload: {
          aps: {sound: "default"},
        },
      },
      android: {
        notification: {sound: "default"},
      },
    });
  },
);

export const onArtistCreated = onDocumentCreated(
  "artists/{artistId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.is_active === false) {
      return;
    }

    const name =
      typeof data.name_en === "string" ? data.name_en : "A new artist";

    await admin.messaging().send({
      topic: NEW_CONTENT_TOPIC,
      notification: {
        title: "New Nasheed Artist Added",
        body: `${name} is now available on QASID`,
      },
      data: {type: "artist", id: event.params.artistId},
      apns: {
        payload: {
          aps: {sound: "default"},
        },
      },
      android: {
        notification: {sound: "default"},
      },
    });
  },
);
