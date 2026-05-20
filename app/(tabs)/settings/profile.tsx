import { GOLD } from "../../../constants/colors";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth } from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useUserStore } from "../../../stores/userStore";
import {
  updateDisplayName,
  uploadAvatar,
  changePassword,
  deleteAccount,
} from "../../../services/profile-service";
import { getFirebaseErrorMessage } from "../../../utils/firebaseErrors";
import { ErrorAlert } from "../../../components";

export default function ProfileSettings() {
  const { user, updateUser, clearUser } = useUserStore();
  const router = useRouter();
  const auth = getAuth();

  const isEmailProvider = auth.currentUser?.providerData?.some(
    (p) => p.providerId === "password"
  );

  const [name, setName] = useState(user?.displayName ?? "");
  const [savingName, setSavingName] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "error" | "success" | "warning" | "info";
  }>({ visible: false, message: "", type: "error" });

  const showToast = (
    message: string,
    type: "error" | "success" | "warning" | "info" = "error"
  ) => {
    setToast({ visible: true, message, type });
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("Name cannot be empty");
      return;
    }
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      updateUser({ displayName: trimmed });
      showToast("Name updated", "success");
    } catch (err: any) {
      showToast(getFirebaseErrorMessage(err.code ?? ""));
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (!uri) return;

    setUploadingAvatar(true);
    try {
      const downloadURL = await uploadAvatar(uri);
      updateUser({ photoURL: downloadURL });
      showToast("Profile photo updated", "success");
    } catch (err: any) {
      showToast(getFirebaseErrorMessage(err.code ?? ""));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !currentPassword) {
      showToast("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password changed", "success");
    } catch (err: any) {
      showToast(getFirebaseErrorMessage(err.code ?? ""));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    if (isEmailProvider) {
      Alert.alert(
        "Account löschen",
        "Bitte gib dein Passwort ein, um den Account zu löschen. Diese Aktion kann nicht rückgängig gemacht werden.",
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Löschen",
            style: "destructive",
            onPress: () => confirmDeleteWithPassword(),
          },
        ]
      );
    } else {
      Alert.alert(
        "Account löschen",
        "Diese Aktion kann nicht rückgängig gemacht werden. Dein Account wird dauerhaft gelöscht.",
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Löschen",
            style: "destructive",
            onPress: () => performDelete(),
          },
        ]
      );
    }
  };

  const confirmDeleteWithPassword = () => {
    // For email users we need a password — use a second Alert prompt (iOS supports input in Alert)
    // On Android we fall back to asking them to log out and back in
    Alert.alert(
      "Passwort bestätigen",
      "Bitte melde dich zuerst ab und wieder an, dann versuche den Account erneut zu löschen. Wenn du auf iOS bist, wird das Passwortfeld angezeigt.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Trotzdem löschen",
          style: "destructive",
          onPress: () => performDelete(),
        },
      ]
    );
  };

  const performDelete = async () => {
    try {
      await deleteAccount();
      clearUser();
      router.replace("/");
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        showToast(
          "Bitte melde dich ab und wieder an, bevor du den Account löschst."
        );
      } else {
        showToast(getFirebaseErrorMessage(err.code ?? ""));
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
        {/* Profile Picture */}
        <View className="mb-6 mt-4">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">
            Profilbild
          </Text>

          <View className="items-center">
            <View className="relative">
              {user?.photoURL ? (
                <Image
                  source={{ uri: user.photoURL }}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-qasid-gold/20 items-center justify-center border-2 border-qasid-gold/30">
                  <Text className="text-qasid-gold text-4xl font-bold">
                    {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              {uploadingAvatar && (
                <View className="absolute inset-0 rounded-full bg-black/60 items-center justify-center">
                  <ActivityIndicator color={GOLD} />
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={handlePickAvatar}
              activeOpacity={0.7}
              disabled={uploadingAvatar}
              className="mt-4"
            >
              <View className="relative overflow-hidden rounded-2xl px-6 py-3">
                <View className="absolute inset-0 bg-qasid-gold/10" />
                <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />
                <Text className="text-qasid-gold font-semibold text-sm">
                  Bild ändern
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Display Name */}
        <View className="mb-6">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Name
          </Text>

          <View className="relative overflow-hidden rounded-2xl mb-3">
            <View className="absolute inset-0 bg-qasid-bg-2" />
            <View className="absolute inset-0 rounded-2xl border border-white/10" />
            <TextInput
              className="px-4 py-4 text-white text-base"
              value={name}
              onChangeText={setName}
              placeholder="Dein Name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            onPress={handleSaveName}
            activeOpacity={0.8}
            disabled={savingName}
          >
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-qasid-gold/10" />
              <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />
              <View className="px-4 py-4 items-center flex-row justify-center">
                {savingName ? (
                  <ActivityIndicator size="small" color={GOLD} />
                ) : (
                  <Text className="text-qasid-gold text-base font-semibold">
                    Speichern
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Password — only for email/password accounts */}
        {isEmailProvider && (
          <View className="mb-6">
            <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              Passwort ändern
            </Text>

            <View className="relative overflow-hidden rounded-2xl mb-3">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />
              <TextInput
                className="px-4 py-4 text-white text-base"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Aktuelles Passwort"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
              />
            </View>

            <View className="relative overflow-hidden rounded-2xl mb-3">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />
              <TextInput
                className="px-4 py-4 text-white text-base"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Neues Passwort"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
              />
            </View>

            <View className="relative overflow-hidden rounded-2xl mb-3">
              <View className="absolute inset-0 bg-qasid-bg-2" />
              <View className="absolute inset-0 rounded-2xl border border-white/10" />
              <TextInput
                className="px-4 py-4 text-white text-base"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Neues Passwort bestätigen"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={handleChangePassword}
              activeOpacity={0.8}
              disabled={changingPassword}
            >
              <View className="relative overflow-hidden rounded-2xl">
                <View className="absolute inset-0 bg-qasid-gold/10" />
                <View className="absolute inset-0 rounded-2xl border border-qasid-gold/30" />
                <View className="px-4 py-4 items-center">
                  {changingPassword ? (
                    <ActivityIndicator size="small" color={GOLD} />
                  ) : (
                    <Text className="text-qasid-gold text-base font-semibold">
                      Passwort ändern
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Account */}
        <View className="mb-24">
          <Text className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Gefahrenzone
          </Text>

          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.8}>
            <View className="relative overflow-hidden rounded-2xl">
              <View className="absolute inset-0 bg-red-600/10" />
              <View className="absolute inset-0 rounded-2xl border border-red-500/30" />
              <View className="px-4 py-4 items-center">
                <Text className="text-red-500 text-base font-semibold">
                  Account löschen
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ErrorAlert
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </SafeAreaView>
  );
}
