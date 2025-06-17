import { HeaderTitle } from "@react-navigation/elements";
import { Stack } from "expo-router";
import { Pressable, View } from "react-native";
import { AntDesign, Fontisto, Feather } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

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
                        width: 50,
                        height: 50,
                        backgroundColor: "#f88f39",
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 20,
                        opacity: pressed ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Fontisto
                      style={{
                        // backgroundColor:"red",
                        padding: 10,
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
                      marginRight: 5, // Optional: add some margin from screen edge
                    }}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        {
                          width: 50,
                          height: 50,
                          backgroundColor: "#f88f39",
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: 20,
                          opacity: pressed ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Feather name="user" size={28} color="white" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        {
                          width: 50,
                          height: 50,
                          backgroundColor: "#f88f39",
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: 20,
                          opacity: pressed ? 0.5 : 1,
                        },
                      ]}
                    >
                      <AntDesign name="setting" size={28} color="white" />
                    </Pressable>
                  </View>
                );
              },
            }}
          />
        </Stack>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
