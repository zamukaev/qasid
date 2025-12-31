import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
interface SearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}
export default function Search({ searchQuery, setSearchQuery }: SearchProps) {
  return (
    <View className="px-4 py-3 bg-qasid-black border-b border-qasid-gray/30">
      <View className="flex-row items-center bg-qasid-gray/50 rounded-xl px-4 py-3">
        <Ionicons
          name="search"
          size={20}
          color="#9CA3AF"
          style={{ marginRight: 8 }}
        />
        <TextInput
          className="flex-1 text-qasid-white text-base"
          placeholder="Surah Name or Number"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>
    </View>
  );
}
