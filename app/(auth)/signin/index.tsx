import { SafeAreaView, View, Text, Pressable, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AntDesign } from "@expo/vector-icons";
import { Link } from "expo-router";

export default function SignUp() {
  return (
    <SafeAreaView className="flex-1  bg-qasid-black">
      <StatusBar style="light" />
      <View className="flex-1 items-center px-6">
        {/* Лого */}
        <View className="items-center mt-36 mb-6">
          <Image
            source={require("../../../assets/logo.png")}
            resizeMode="contain"
            className="w-28 h-28"
          />
        </View>

        {/* Заголовки */}
        <View className="items-center px-2">
          <Text className="text-qasid-title text-[36px] leading-[64px] font-bold">
            Sign in to Qasid
          </Text>
        </View>

        {/* Кнопки соцрегистрации */}
        <View className="mt-8  gap-y-5">
          <Link href="signin/email" asChild>
            <Pressable
              className="items-center  rounded-2xl bg-white/05 px-10 py-5 bg-qasid-gold"
              android_ripple={{ color: "#3a2f11" }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              onPress={() => {}}
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
            onPress={() => {}}
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
            className="items-center  rounded-2xl bg-white/05 px-10 py-5  bg-qasid-gray"
            android_ripple={{ color: "#2a2a2a" }}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            onPress={() => {}}
          >
            <View className="flex-row w-full">
              <AntDesign
                name="apple-o"
                size={22}
                color="white"
                className="mr-8"
              />
              <Text className="text-white text-[20px]">
                Continue with Apple
              </Text>
            </View>
          </Pressable>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-qasid-gold mt-10 text-[16px]">
            Don't have an account?
          </Text>
          <Link
            className="text-qasid-gold mt-2 text-[16px] font-bold underline"
            href="signup"
          >
            Sign up
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
