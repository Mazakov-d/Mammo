import { HeaderTitle } from "@react-navigation/elements";
import { Stack } from "expo-router";
import { Pressable, View } from "react-native";
import { AntDesign, Fontisto, Feather } from "@expo/vector-icons";
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
            options={{
              headerTransparent: true,
              headerLeft: () => {
                return (
                  <Pressable
                    style={({ pressed }) => [
                      {
                        width: Layout.buttonWidth,
                        height: Layout.buttonHeight,
                        backgroundColor: Colors.primary,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: Layout.radiusLarge,
                        opacity: pressed ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Fontisto
                      style={{
                        // backgroundColor:"red",
                        padding: Layout.paddingSmall,
                      }}
                      name="bell"
                      size={24}
                      color="white"
                    />
                  </Pressable>
                );
              },
              headerRight: () => {
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10, // Space between buttons
                      marginRight: Layout.marginSmall, // Optional: add some margin from screen edge
                    }}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        {
                          width: Layout.buttonWidth,
                          height: Layout.buttonHeight,
                          backgroundColor: Colors.primary,
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: Layout.radiusLarge,
                          opacity: pressed ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Feather name="user" size={28} color="white" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        {
                          width: Layout.buttonWidth,
                          height: Layout.buttonHeight,
                          backgroundColor: Colors.primary,
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: Layout.radiusLarge,
                          opacity: pressed ? 0.5 : 1,
                        },
                      ]}
                    >
                      <AntDesign name="setting" size={28} color="white" />
                    </Pressable>
                  </View>
                );
              },
			  headerTitle: "",
            }}
          />
        </Stack>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
