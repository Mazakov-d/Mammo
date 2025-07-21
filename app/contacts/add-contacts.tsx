import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuthStore} from "@/store/useAuthStore";
import { useContactsStore } from "@/store/useContactsStore";

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  relationshipStatus?: 'none' | 'friend' | 'sent' | 'received';
}

export default function AddFriendsScreen() {
  const router = useRouter();
  const session = useAuthStore.getState().session;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const { friends, sentInvitations, receivedInvitations, sendInvitation, acceptInvitation, declineInvitation } = useContactsStore();

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        searchProfiles();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const searchProfiles = async () => {
  if (!session?.user?.id) return;

  setLoading(true);
  try {
    // 1) Recherche des profils
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('full_name', `%${searchQuery}%`)
      .neq('id', session.user.id)
      .limit(20);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      setSearchResults([]);
      return;
    }

    // 3) On détermine le statut pour chaque profil
    const results: Profile[] = profiles.map(profile => {
      let relationshipStatus: 'none' | 'friend' | 'sent' | 'received' = 'none';

      if (friends.some(c => c.contact_id === profile.id)) {
        relationshipStatus = 'friend';
      } else if (sentInvitations.some(c => c.contact_id === profile.id)) {
        relationshipStatus = 'sent';
      } else if (receivedInvitations.some(c => c.user_id === profile.id)) {
        relationshipStatus = 'received';
      }

      return { ...profile, relationshipStatus };
    });

    setSearchResults(results);
  } catch (error) {
    console.error('Search error:', error);
    Alert.alert('Erreur', "Impossible de rechercher des utilisateurs");
  } finally {
    setLoading(false);
  }
};

  const renderProfile = ({ item }: { item: Profile }) => {
    const renderButton = () => {
      switch (item.relationshipStatus) {
        case 'friend':
          return (
            <View style={styles.statusBadge}>
              <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.statusText}>Ami</Text>
            </View>
          );

        case 'sent':
          return (
            <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="schedule" size={20} color="#FF9800" />
              <Text style={[styles.statusText, { color: '#FF9800' }]}>En attente</Text>
            </View>
          );

        case 'received':
          return (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#4CAF50', marginRight: 8 }]}
                onPress={() => acceptInvitation(item.id)}
              >
                <MaterialIcons name="check" size={16} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#f44336' }]}
                onPress={() => declineInvitation(item.id)}
              >
                <MaterialIcons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          );

        default:
          return (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                sendInvitation(item.id);
                searchProfiles();
              }}
            >
              <AntDesign name="adduser" size={20} color="white" />
              <Text style={styles.actionButtonText}>Ajouter</Text>
            </TouchableOpacity>
          );
      }
    };

    return (
      <View style={styles.profileItem}>
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.avatarText}>
                {item.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{item.full_name}</Text>
          {item.relationshipStatus === 'received' && (
            <Text style={styles.requestText}>Vous a envoyé une demande</Text>
          )}
        </View>

        {renderButton()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Ajouter des amis",
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

      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Recherche le nom de ton ami..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <AntDesign name="closecircle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : searchQuery.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={80} color="#E0E0E0" />
          <Text style={styles.emptyText}>
            Recherchez des amis par leur nom
          </Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="person-search" size={80} color="#E0E0E0" />
          <Text style={styles.emptyText}>
            Aucun utilisateur trouvé
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderProfile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 30,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  requestText: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
});