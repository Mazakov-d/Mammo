import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import AuthProvider from "@/provider/AuthProvider";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect}  from "react";

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <GestureHandlerRootView>
      <BottomSheetModalProvider>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="alerts" />
            <Stack.Screen name="contacts" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

