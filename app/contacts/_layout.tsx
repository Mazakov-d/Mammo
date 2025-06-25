import React from 'react';
import { Stack } from 'expo-router';

export default function ContactsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-contacts" />
    </Stack>
  );
}