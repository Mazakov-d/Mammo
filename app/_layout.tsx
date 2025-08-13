import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect } from "react";
import { MapProvider } from "@/contexts/MapContext";

export default function RootLayout() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <MapProvider>
          <Stack>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="alerts" />
            <Stack.Screen name="contacts" options={{ headerShown: false }} />
          </Stack>
        </MapProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}