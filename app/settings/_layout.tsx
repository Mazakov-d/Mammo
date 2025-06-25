import React from "react";
import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="policy" />
    </Stack>
  );
}
