import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { Stack, useRouter } from "expo-router";
import { AntDesign } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";

export default function SettingScreen() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Reglages",
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
      <Image
        source={require("@/assets/images/mammo_settings.png")}
        style={styles.settingsImage}
        resizeMode="contain"
      />
      <View style={styles.buttonGroup}>
        <Pressable
          style={styles.orangeButton}
          onPress={() => router.push("/settings/profile")}
        >
          <Text style={styles.orangeButtonText}>Profil</Text>
        </Pressable>
        <Pressable
          style={styles.orangeButton}
          onPress={() => router.push("/settings/policy")}
        >
          <Text style={styles.orangeButtonText}>Politique de confidentialité</Text>
        </Pressable>
        <Pressable
          style={[styles.orangeButton, styles.logoutButton]}
          onPress={handleSignOut}
        >
          <Text style={[styles.orangeButtonText, { color: Colors.red }]}>Déconnexion</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  buttonGroup: {
    marginTop: 20,
    gap: 20,
  },
  orangeButton: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orangeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: "bold",
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.red,
  },
  settingsImage: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 30,
	marginTop: 100,
  },
}); 