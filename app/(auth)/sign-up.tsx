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
import { FontAwesome6, Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Colors } from "@/constants/Colors";
import { Stack, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

const { width, height } = Dimensions.get("window");

export default function SignUpScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

// app/(auth)/sign-up.tsx - Fixed handleSignUp function

const handleSignUp = async () => {
  // Validate all fields
  if (!email || !firstName || !lastName || !password || !confirmPassword) {
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
  
  try {
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    
    // 1. Sign up the user first
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }
      }
    });

    if (signUpError) {
	console.log(signUpError);
	 throw signUpError;
	}	

    if (!data?.user) {
      throw new Error("Échec de la création du compte utilisateur");
    }

    console.log("✅ User account created:", data.user.id);

    // 2. Wait for auth trigger to potentially create profile
    console.log("⏳ Waiting for database trigger...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Check if profile exists, create if not (idempotent operation)
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Error checking existing profile:", checkError);
      throw new Error("Erreur lors de la vérification du profil");
    }

    if (!existingProfile) {
      // Profile doesn't exist, create it
      console.log("📝 Creating profile record...");
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });

      if (insertError) {
        console.error("Profile creation error:", insertError);
        throw new Error("Erreur lors de la création du profil");
      }
      
      console.log("✅ Profile created successfully");
    } else {
      // Profile exists, update it with latest info
      console.log("🔄 Updating existing profile...");
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        // Don't throw here - profile exists, update failure is not critical
        console.log("⚠️ Profile update failed but continuing...");
      } else {
        console.log("✅ Profile updated successfully");
      }
    }

    // 4. Sign in the user automatically with unlimited retry logic
    console.log("🔐 Signing in user...");
    let signInAttempts = 0;
    
    while (true) {
      try {
        signInAttempts++;
        console.log(`🔐 Sign-in attempt ${signInAttempts}...`);
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError) {
          console.log("✅ Auto sign-in successful");
          // Successfully signed in, redirect to main app
          router.replace("/");
          return;
        }

        // If sign-in failed, log and retry with exponential backoff
        console.warn(`⚠️ Sign-in attempt ${signInAttempts} failed:`, signInError.message);
        
        // Exponential backoff: 1s, 2s, 4s, 8s, then max 10s
        const delay = Math.min(1000 * Math.pow(2, signInAttempts - 1), 10000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (signInRetryError) {
        console.error(`❌ Sign-in attempt ${signInAttempts} error:`, signInRetryError);
        
        // Wait before retrying even on exceptions
        const delay = Math.min(1000 * Math.pow(2, signInAttempts - 1), 10000);
        console.log(`⏳ Retrying after error in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

  } catch (error: any) {
    console.error("❌ Sign-up process failed:", error);
    
    // Provide user-friendly error messages
    let errorMessage = "Une erreur est survenue lors de l'inscription";
    
    if (error.message?.includes("already registered")) {
      errorMessage = "Cette adresse e-mail est déjà utilisée";
    } else if (error.message?.includes("Invalid email")) {
      errorMessage = "Adresse e-mail invalide";
    } else if (error.message?.includes("Password")) {
      errorMessage = "Le mot de passe ne respecte pas les critères requis";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    Alert.alert("Erreur d'inscription", errorMessage);
    
  } finally {
    setLoading(false);
  }
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
          {/* First Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Prénom</Text>
            <View style={styles.inputWrapper}>
              <Feather
                name="user"
                size={20}
                color={"#6c757d"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Votre prénom"
                placeholderTextColor="#6c757d"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Last Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nom</Text>
            <View style={styles.inputWrapper}>
              <Feather
                name="user"
                size={20}
                color={"#6c757d"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Votre nom"
                placeholderTextColor="#6c757d"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

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
    paddingTop: 20,
    paddingBottom: 30,
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