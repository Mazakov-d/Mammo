import {
  View,
  StyleSheet,
  TextInput,
  Text,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { FontAwesome6, Feather, MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Colors } from "@/constants/Colors";
import { Link, router, Stack, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

const { width, height } = Dimensions.get("window");

export default function SignUpScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Erreur",
        "Le mot de passe doit contenir au moins 6 caractères"
      );
      return;
    }

    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    });

    if (data && !error) {
      Alert.alert(
        "Succès",
        "Veuillez vérifier votre email pour confirmer votre inscription.",
        [{ text: "OK" }]
      );
    }
    if (error) Alert.alert("Erreur", error.message);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Image
            source={require("../../assets/images/mammo_face_sat_no_bg.png")}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
          />
          <Text style={styles.welcomeTitle}>Créer un compte</Text>
          <Text style={styles.welcomeSubtitle}>
            Rejoignez-nous pour commencer
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Adresse e-mail</Text>
            <View style={styles.inputWrapper}>
              <Feather
                name="mail"
                size={20}
                color={"#6c757d"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="user@example.fr"
                placeholderTextColor="#6c757d"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Feather
                name="lock"
                size={20}
                color={"#6c757d"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Créez un mot de passe"
                placeholderTextColor="#6c757d"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome6
                  name={showPassword ? "eye" : "eye-slash"}
                  size={18}
                  color="#6c757d"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Feather
                name="shield"
                size={20}
                color={"#6c757d"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Confirmez votre mot de passe"
                placeholderTextColor="#6c757d"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome6
                  name={showConfirmPassword ? "eye" : "eye-slash"}
                  size={18}
                  color="#6c757d"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Requirements */}
          <View style={styles.passwordRequirements}>
            <Text style={styles.requirementsTitle}>
              Le mot de passe doit contenir :
            </Text>
            <Text style={styles.requirementItem}>• Au moins 6 caractères</Text>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[
              styles.signUpButton,
              loading && styles.signUpButtonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>
              {loading ? "Inscription..." : "S'inscrire"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Section */}
        <View style={styles.footerSection}>
          <Text style={styles.footerText}>Déjà un compte ? </Text>
            <TouchableOpacity
              onPress={() => {
                router.push("/sign-in");
              }}
            >
              <Text style={styles.footerLinkText}>Se connecter</Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 60,
  },
  headerSection: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 22,
  },
  formSection: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#e9ecef",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.primary,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 4,
  },
  passwordRequirements: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    marginBottom: 4,
  },
  requirementItem: {
    fontSize: 12,
    color: "#6c757d",
    lineHeight: 16,
  },
  signUpButton: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.orange,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  footerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: "#6c757d",
  },
  footerLinkText: {
    color: Colors.orange,
    fontWeight: "600",
    fontSize: 14,
  },
});
