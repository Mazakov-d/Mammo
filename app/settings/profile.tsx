import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get("window");

interface Profile {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  birthday?: string;
  avatar_url?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [session?.user?.id]);

  const loadProfile = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, birthday, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Profile loading error:', error);
        throw error;
      }

      console.log('Loaded profile:', data); // Debug log
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin de l\'autorisation pour accéder à vos photos');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Fixed: use MediaTypeOptions
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Selected image:', asset);
        await uploadImage(asset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const uploadImage = async (imageUri: string) => {
    try {
      setUploading(true);

      if (!session?.user?.id) {
        throw new Error('No user found');
      }

      console.log('Starting upload for image:', imageUri);
      
      const fileName = `${session.user.id}-${Date.now()}.jpg`;

      // Method: Use React Native File System approach
      const formData = new FormData();
      
      // Create proper file object for React Native
      const file = {
        uri: imageUri,
        type: 'image/jpeg',
        name: fileName,
      };

      console.log('Prepared file object:', file);

      formData.append('file', file as any);

      // Get auth session for manual upload
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession?.access_token) {
        throw new Error('No auth token found');
      }

      // Upload using direct fetch to Supabase Storage API
      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/avatars/${fileName}`;
      
      console.log('Uploading to URL:', uploadUrl);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: formData,
      });

      console.log('Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed with response:', errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload successful:', uploadResult);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      const publicUrl = urlData.publicUrl;
      console.log('Generated public URL:', publicUrl);

      // Wait a moment for the file to be available
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test if the uploaded image is accessible
      try {
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        console.log('Image accessibility test:', testResponse.status, testResponse.headers);
        
        const contentLength = testResponse.headers.get('content-length');
        console.log('Uploaded file size:', contentLength, 'bytes');
        
        if (!testResponse.ok || contentLength === '0') {
          throw new Error(`Uploaded image is not accessible or empty (size: ${contentLength})`);
        }
      } catch (testError) {
        console.error('Image accessibility test failed:', testError);
        throw new Error('Uploaded image is not accessible');
      }

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      console.log('Avatar URL updated successfully in database');

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);

      Alert.alert('Succès', 'Photo de profil mise à jour !');
      
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', `Impossible de mettre à jour la photo de profil: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      Alert.alert(
        'Supprimer la photo',
        'Êtes-vous sûr de vouloir supprimer votre photo de profil ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              setUploading(true);
              
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', session?.user?.id);

              if (error) {
                console.error('Error removing avatar:', error);
                Alert.alert('Erreur', 'Impossible de supprimer la photo');
              } else {
                setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
                Alert.alert('Succès', 'Photo de profil supprimée');
              }
              
              setUploading(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in removeAvatar:', error);
    }
  };

  const formatBirthday = (birthday?: string) => {
    if (!birthday) return 'Non renseigné';
    
    try {
      const date = new Date(birthday);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return birthday;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Image
          source={require("@/assets/images/mammo_painting.png")}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <Stack.Screen
          options={{
            headerTitle: "Mon Profil",
            headerTitleAlign: "center",
            headerTransparent: true,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ marginLeft: 10 }}
              >
                <AntDesign name="arrowleft" size={28} color={Colors.orange} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Mon Profil",
          headerTitleAlign: "center",
          headerTransparent: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 10 }}
            >
              <AntDesign name="arrowleft" size={28} color={Colors.orange} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.content}>
        {/* Background image behind content */}
        <Image
          source={require("@/assets/images/mammo_painting.png")}
          style={styles.backgroundImage}
          resizeMode="contain"
        />

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {profile?.avatar_url ? (
                <Image 
                  source={{ uri: profile.avatar_url }} 
                  style={styles.avatar}
                  onError={(error) => {
                    console.log('Avatar image failed to load. URL:', profile.avatar_url);
                    console.log('Error details:', error.nativeEvent);
                    // Fallback if image fails to load
                    setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
                  }}
                  onLoad={() => {
                    console.log('Avatar image loaded successfully');
                  }}
                />
              ) : (
                <View style={[styles.avatar, styles.defaultAvatar]}>
                  <Text style={styles.avatarText}>
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              
              {/* Camera button overlay */}
              <TouchableOpacity 
                style={styles.cameraButton}
                onPress={pickImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Feather name="camera" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>

            {/* Avatar Actions */}
            <View style={styles.avatarActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={pickImage}
                disabled={uploading}
              >
                <Feather name="upload" size={18} color={Colors.orange} />
                <Text style={styles.actionButtonText}>
                  {profile?.avatar_url ? 'Changer' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
              
              {profile?.avatar_url && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.removeButton]}
                  onPress={removeAvatar}
                  disabled={uploading}
                >
                  <MaterialIcons name="delete" size={18} color={Colors.red} />
                  <Text style={[styles.actionButtonText, { color: Colors.red }]}>
                    Supprimer
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Profile Information */}
          <View style={styles.infoSection}>
            {/* Full Name */}
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Feather name="user" size={20} color={Colors.orange} />
                <Text style={styles.infoLabel}>Nom complet</Text>
                <MaterialIcons name="lock" size={16} color="#999" />
              </View>
              <Text style={styles.infoValue}>
                {profile?.full_name || 'Non renseigné'}
              </Text>
            </View>

            {/* Birthday */}
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Feather name="calendar" size={20} color={Colors.orange} />
                <Text style={styles.infoLabel}>Date de naissance</Text>
                <MaterialIcons name="lock" size={16} color="#999" />
              </View>
              <Text style={styles.infoValue}>
                {formatBirthday(profile?.birthday)}
              </Text>
            </View>

            {/* Account Info */}
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Feather name="mail" size={20} color={Colors.orange} />
                <Text style={styles.infoLabel}>Adresse e-mail</Text>
                <MaterialIcons name="lock" size={16} color="#999" />
              </View>
              <Text style={styles.infoValue}>
                {session?.user?.email || 'Non renseigné'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    paddingTop: 120,
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: width * 0.8,
    height: height * 0.6,
    alignSelf: 'center',
    top: '20%',
    opacity: 0.05,
    zIndex: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.orange,
    fontSize: 16,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.orange,
  },
  defaultAvatar: {
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.orange,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.orange,
    gap: 6,
  },
  removeButton: {
    borderColor: Colors.red,
  },
  actionButtonText: {
    color: Colors.orange,
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    gap: 12,
  },
  infoItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    marginLeft: 28,
  },
});