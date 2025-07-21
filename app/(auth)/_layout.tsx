import { View, Text } from "react-native";
import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/store/useAuthStore";

export default function AuthLayout() {
  const { session } = useAuthStore();
  if (session) {
    return <Redirect href="/" />;
  }
  return (
    <Stack>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
    </Stack>
  );
}
