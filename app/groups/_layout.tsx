// app/groups/_layout.tsx - Groups Layout

import React from 'react';
import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}