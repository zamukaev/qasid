import * as admin from "firebase-admin";

// Centralized, idempotent Admin SDK initialization. Importing this module from
// anywhere guarantees `admin` is initialized exactly once.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export {admin};

export const db = (): admin.firestore.Firestore => admin.firestore();
