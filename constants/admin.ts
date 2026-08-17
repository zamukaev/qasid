// TEMP admin curation hotfix — remove with MoodPickerModal.
//
// Firebase UIDs allowed to edit `nasheeds/{id}.moods` straight from the app.
// Whatever is listed here must match the `match /nasheeds/{nasheedId}` rule in
// backend/firestore.rules — the client gate only hides the UI, the rule is what
// actually enforces it.
export const ADMIN_UIDS: readonly string[] = [
  "UTWOVcxhBVTksYtPXnipiSKHpdk2",
];
