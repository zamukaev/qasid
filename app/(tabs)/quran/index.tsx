import { useEffect } from "react";
import { Text, View } from "react-native";
import { axiosInstance } from "../../../services/api-service";

export default function Quran() {
  //test api
  const fetchQuran = async () => {
    try {
      const response = await axiosInstance.get("/chapters");
      console.log(response.data);
    } catch (error) {
      console.error(error, "error hier");
    }
  };
  useEffect(() => {
    fetchQuran();
  }, []);

  return (
    <View>
      <Text> Quran</Text>
    </View>
  );
}
