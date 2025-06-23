import React, { useState } from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { AntDesign } from "@expo/vector-icons";

export default function AlertsScreen() {
  // Always show no alerts for now
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Alertes",
          headerTitleAlign: "center",
          headerTransparent: true,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  marginLeft: 10,
                  opacity: pressed ? 0.5 : 1,
                },
              ]}
            >
              <AntDesign name="arrowleft" size={28} color={Colors.orange} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.noAlertsContainer}>
        <Image
          source={require("@/assets/images/mammo_no_alert.png")}
          style={styles.noAlertsImage}
          resizeMode="contain"
        />
        <Text style={styles.noAlertsText}>Merci de vous inquiéter, mais tout va bien !</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  noAlertsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAlertsImage: {
    width: 180,
    height: 180,
    marginBottom: 30,
  },
  noAlertsText: {
    color: Colors.orange,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 