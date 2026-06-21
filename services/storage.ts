import { getApp } from "@react-native-firebase/app";
import { getStorage, ref, getDownloadURL } from "@react-native-firebase/storage";

// Resolves a Firebase Storage path to a download URL. Pass-through for values
// that are already HTTP(S) URLs, and best-effort fallback to the raw path.
export const resolveStorageUrl = async (path: string): Promise<string> => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  try {
    return await getDownloadURL(ref(getStorage(getApp()), path));
  } catch {
    return path;
  }
};
