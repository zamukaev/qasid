import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { AntDesign } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  getAuth,
  GoogleAuthProvider,
  AppleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { useState } from "react";
import appleAuth from "@invertase/react-native-apple-authentication";

import { ErrorAlert } from "../../../components";
import { getFirebaseErrorMessage } from "../../../utils/firebaseErrors";

GoogleSignin.configure({
  webClientId:
    "987885549442-9ue4mpgabm5aah6mh1jh5mf8la4kvecn.apps.googleusercontent.com",
});

export default function SignUp() {
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);

  const signInWithApple = async () => {
    try {
      const appleAuthResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      if (!appleAuthResponse.identityToken) {
        console.log("Apple Sign-In failed – no identity token");
        throw new Error("Apple Sign-In failed – no identity token");
      }

      const { identityToken, nonce } = appleAuthResponse;
      const appleCredential = AppleAuthProvider.credential(
        identityToken,
        nonce ?? undefined,
      );

      const auth = getAuth();
      await signInWithCredential(auth, appleCredential);
    } catch (e: any) {
      console.log("Apple Sign-In error:", e);
      if (e.code === appleAuth.Error.CANCELED) return;
      const errorMessage = e.code
        ? getFirebaseErrorMessage(e.code)
        : "Apple sign-in failed. Please try again";
      setError(errorMessage);
      setShowError(true);
    }
  };

  const singInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const signinresult = await GoogleSignin.signIn();
      const idToken = signinresult?.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");

      const auth = getAuth();
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (e: any) {
      const errorMessage = e.code
        ? getFirebaseErrorMessage(e.code)
        : "Google sign-in failed. Please try again";
      setError(errorMessage);
      setShowError(true);
    }
  };

  return (
    <SafeAreaView className="flex-1  bg-qasid-black">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerTitle: "" }} />
      <View className="flex-1 items-center px-6">
        {/* Лого */}
        <View className="items-center mt-36">
          <Image
            source={require("../../../assets/logo1.png")}
            className="w-60 h-60 mb-[-40px]"
          />
        </View>

        {/* Заголовки */}
        <View className="items-center px-2">
          <Text className="text-qasid-gold text-[36px] leading-[64px] font-bold">
            Sign up to listen
          </Text>
          <Text className="text-white/70 text-lg mt-2">
            Create your account.
          </Text>
        </View>

        {/* Кнопки соцрегистрации */}
        <View className="mt-8 w-full gap-y-4">
          <Link href="signup/email" asChild>
            <Pressable
              className="w-full items-center rounded-2xl bg-qasid-gold px-6 py-4"
              android_ripple={{ color: "#3a2f11" }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <View className="flex-row items-center justify-center gap-x-3">
                <AntDesign name="mail" size={20} color="black" />
                <Text className="text-qasid-black font-semibold text-lg">
                  Continue with Email
                </Text>
              </View>
            </Pressable>
          </Link>

          <Pressable
            className="w-full items-center rounded-2xl border border-white/20 px-6 py-4"
            android_ripple={{ color: "#2a2a2a" }}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            onPress={singInWithGoogle}
          >
            <View className="flex-row items-center justify-center gap-x-3">
              <AntDesign name="google" size={20} color="white" />
              <Text className="text-white font-semibold text-lg">
                Continue with Google
              </Text>
            </View>
          </Pressable>

          {Platform.OS === "ios" && (
            <Pressable
              className="w-full items-center rounded-2xl border border-white/20 px-6 py-4"
              android_ripple={{ color: "#2a2a2a" }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              onPress={signInWithApple}
            >
              <View className="flex-row items-center justify-center gap-x-3">
                <AntDesign name="apple-o" size={20} color="white" />
                <Text className="text-white font-semibold text-lg">
                  Continue with Apple
                </Text>
              </View>
            </Pressable>
          )}
        </View>
        <View className="flex-1 items-center">
          <Text className="text-qasid-gold mt-10 text-[16px]">
            Already have an account?
          </Text>
          <Link
            className="text-qasid-gold mt-2 text-[16px] font-bold underline"
            href="signin"
          >
            Sign in
          </Link>
        </View>
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
