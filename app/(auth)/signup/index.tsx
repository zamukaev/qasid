import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { FontAwesome, AntDesign } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";

GoogleSignin.configure({
  webClientId:
    "987885549442-9ue4mpgabm5aah6mh1jh5mf8la4kvecn.apps.googleusercontent.com",
});

export default function SignUp() {
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
      Alert.alert("Google Login", e.message);
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
            source={require("../../../assets/logo.png")}
            resizeMode="contain"
            className="w-28 h-28"
          />
        </View>

        {/* Заголовки */}
        <View className="items-center px-2">
          <Text className="text-qasid-title text-[36px] leading-[64px] font-bold">
            Sign up to listen
          </Text>
          <Text className="text-white/70 text-lg mt-2">
            Create your account.
          </Text>
        </View>

        {/* Кнопки соцрегистрации */}
        <View className="mt-8  gap-y-5">
          <Link href="signup/email" asChild>
            <Pressable
              className="items-center  rounded-2xl bg-white/05 px-10 py-5 bg-qasid-gold"
              android_ripple={{ color: "#3a2f11" }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <View className="flex-row w-full">
                <AntDesign
                  name="mail"
                  size={22}
                  color="black"
                  className="mr-8"
                />
                <Text className="text-[20px] text-qasid-black">
                  Continue with Email
                </Text>
              </View>
            </Pressable>
          </Link>
          <Pressable
            className="items-center rounded-2xl bg-white/05 px-10 py-5 bg-qasid-gray"
            android_ripple={{ color: "#2a2a2a" }}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            onPress={singInWithGoogle}
          >
            <View className="flex-row w-full">
              <AntDesign
                name="google"
                size={22}
                color="white"
                className="mr-8"
              />
              <Text className="text-white text-[20px]">
                Continue with Google
              </Text>
            </View>
          </Pressable>

          <Pressable
            disabled={true}
            className="items-center  rounded-2xl bg-white/05 px-10 py-5  bg-gray-800/50"
            android_ripple={{ color: "#2a2a2a" }}
            style={({ pressed }) => [{ opacity: 0.5 }]}
            onPress={() => {}}
          >
            <View className="flex-row w-full">
              <AntDesign
                name="apple-o"
                size={22}
                color="gray"
                className="mr-8"
              />
              <Text className="text-gray-400 text-[20px]">
                Continue with Apple
              </Text>
            </View>
          </Pressable>
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
    </SafeAreaView>
  );
}
