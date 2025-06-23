import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { id, email } = useLocalSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!firstName || !lastName || !birthday) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .insert({
        id,
        email,
        first_name: firstName,
        last_name: lastName,
        birthday,
      });
    setLoading(false);
    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      Alert.alert("Succès", "Profil complété !");
      router.replace("/"); // Or wherever you want to redirect
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complétez votre profil</Text>
      <TextInput
        style={styles.input}
        placeholder="Prénom"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Nom"
        value={lastName}
        onChangeText={setLastName}
      />
      <TextInput
        style={styles.input}
        placeholder="Date de naissance (YYYY-MM-DD)"
        value={birthday}
        onChangeText={setBirthday}
      />
      <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Enregistrement..." : "Enregistrer"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 16 },
  button: { backgroundColor: "#FFA500", padding: 16, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
});