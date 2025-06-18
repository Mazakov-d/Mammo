import { View, Text } from "react-native";
import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/provider/AuthProvider";

export default function AuthLayout() {
	const { session } = useAuth();
	if (session) {
		return <Redirect href="/" />;
	}
	return <Stack />;
}