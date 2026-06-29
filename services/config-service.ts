import firestore from "@react-native-firebase/firestore";

export async function fetchPremiumOverrideEmails(): Promise<string[]> {
  const doc = await firestore()
    .collection("config")
    .doc("premiumAccounts")
    .get();
  return (doc.data()?.emails as string[]) ?? [];
}
