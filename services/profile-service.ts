import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  updateProfile,
} from "@react-native-firebase/auth";
import { getStorage, ref, putFile, getDownloadURL } from "@react-native-firebase/storage";
import { getApp } from "@react-native-firebase/app";

export async function updateDisplayName(name: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not authenticated");
  await updateProfile(user, { displayName: name });
}

export async function uploadAvatar(localUri: string): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not authenticated");

  const storage = getStorage(getApp());
  const avatarRef = ref(storage, `users/${user.uid}/avatar.jpg`);
  await putFile(avatarRef, localUri);

  const downloadURL = await getDownloadURL(avatarRef);
  await updateProfile(user, { photoURL: downloadURL });
  return downloadURL;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = getAuth().currentUser;
  if (!user || !user.email) throw new Error("Not authenticated");

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function deleteAccount(password?: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not authenticated");

  const isEmailProvider = user.providerData?.some(
    (p) => p.providerId === "password"
  );

  if (isEmailProvider && password && user.email) {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  }

  await deleteUser(user);
}
