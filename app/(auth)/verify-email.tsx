import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuth,
  sendEmailVerification,
  signOut,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";

import { GOLD } from "../../constants/colors";
import { useUserStore } from "../../stores/userStore";
import { ErrorAlert } from "../../components";
import { getFirebaseErrorMessage } from "../../utils/firebaseErrors";

const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen() {
  const { user, setUser, clearUser } = useUserStore();
  const router = useRouter();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [notVerifiedError, setNotVerifiedError] = useState(false);
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleConfirm = async () => {
    setChecking(true);
    setNotVerifiedError(false);
    try {
      const auth = getAuth();
      await auth.currentUser?.reload();
      const refreshed = auth.currentUser;
      if (refreshed?.emailVerified) {
        setUser(refreshed);
        // routing in app/index.tsx picks up the store change and navigates to tabs
      } else {
        setNotVerifiedError(true);
      }
    } catch {
      setError("Could not check verification status. Please try again.");
      setShowError(true);
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendEmailVerification(currentUser);
        setCountdown(RESEND_COOLDOWN);
      }
    } catch (e: any) {
      const err = e as FirebaseAuthTypes.NativeFirebaseAuthError;
      console.error(
        "[Auth] resend verification failed:",
        err?.code,
        err?.message,
      );
      setError(getFirebaseErrorMessage(err?.code));
      setShowError(true);
    } finally {
      setResending(false);
    }
  };

  const handleLogOut = async () => {
    try {
      await signOut(getAuth());
      clearUser();
      router.replace("/");
    } catch (error) {
      console.error("Error signing out", error);
      setError("Could not sign out. Please try again.");
      setShowError(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-8 h-20 w-20 items-center justify-center rounded-full bg-qasid-gold/15 border border-qasid-gold/30">
          <Ionicons name="mail-outline" size={36} color={GOLD} />
        </View>

        <Text className="text-white text-3xl font-bold text-center mb-3">
          Verify your email
        </Text>

        <Text className="text-white/60 text-base text-center mb-2">
          We sent a verification link to:
        </Text>
        <Text className="text-qasid-gold text-base font-semibold text-center mb-6">
          {user?.email ?? "your email"}
        </Text>

        <Text className="text-white/50 text-sm text-center mb-10 leading-6">
          Open your inbox and click the link to activate your account. Check
          your spam folder if you don't see it.
        </Text>

        {notVerifiedError && (
          <Text className="text-qasid-red text-sm text-center mb-4">
            Email not verified yet. Please check your inbox and try again.
          </Text>
        )}

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={checking}
          className="w-full items-center rounded-2xl bg-qasid-gold px-6 py-4 mb-4"
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#090A07" />
          ) : (
            <Text className="text-qasid-black font-semibold text-lg">
              I've confirmed
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resending || countdown > 0}
          className="w-full items-center rounded-2xl border border-white/20 px-6 py-4 mb-8"
          activeOpacity={0.8}
          style={{ opacity: countdown > 0 ? 0.5 : 1 }}
        >
          {resending ? (
            <ActivityIndicator color={GOLD} />
          ) : (
            <Text className="text-white font-semibold text-lg">
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend email"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogOut} activeOpacity={0.7}>
          <Text className="text-white/40 text-sm">Log out</Text>
        </TouchableOpacity>
      </View>

      <ErrorAlert
        visible={showError}
        message={error}
        type="error"
        onClose={() => setShowError(false)}
      />
    </SafeAreaView>
  );
}
