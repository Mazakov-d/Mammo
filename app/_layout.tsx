import { HeaderTitle } from "@react-navigation/elements";
import { Stack } from "expo-router";
import { Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Colors, Layout } from "../constants/Colors";

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <BottomSheetModalProvider>
        <Stack>
          <Stack.Screen
            name="index"
          />
        </Stack>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
