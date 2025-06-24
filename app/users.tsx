import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";

interface Friend {
  id: string;
  full_name: string;
  avatar_url?: string;
  isOnline: boolean;
  lastSeen?: string;
  isAlert?: boolean;
}

export default function UsersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFriends();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    // Filter friends based on search query
    if (searchQuery.trim() === "") {
      setFilteredFriends(friends);
    } else {
      const filtered = friends.filter((friend) =>
        friend.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  const setupRealtimeSubscription = () => {
    // Subscribe to friends' online status changes
    const friendsSubscription = supabase
      .channel('friends_status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations'
        },
        () => {
          loadFriends();
        }
      )
      .subscribe();

    return () => {
      friendsSubscription.unsubscribe();
    };
  };

  const loadFriends = async () => {
    try {
      setLoading(true);
      
      if (!session?.user?.id) return;

      // Get all contacts where current user is either user_id or contact_id and status is accepted
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .or(`user_id.eq.${session.user.id},contact_id.eq.${session.user.id}`)
        .eq('status', 'accepted');

      if (contactsError) throw contactsError;

      // Extract friend IDs
      const friendIds = contacts?.map(contact => 
        contact.user_id === session.user.id ? contact.contact_id : contact.user_id
      ) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        setFilteredFriends([]);
        return;
      }

      // Get friend profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      // Get online status from user_locations
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: locations, error: locationsError } = await supabase
        .from('user_locations')
        .select('user_id, is_alert, updated_at')
        .in('user_id', friendIds)
        .gte('updated_at', thirtyMinutesAgo);

      if (locationsError) throw locationsError;

      // Combine data
      const friendsData: Friend[] = profiles?.map(profile => {
        const location = locations?.find(loc => loc.user_id === profile.id);
        const isOnline = !!location;
        
        return {
          id: profile.id,
          full_name: profile.full_name || 'Sans nom',
          avatar_url: profile.avatar_url,
          isOnline,
          lastSeen: location?.updated_at,
          isAlert: location?.is_alert || false,
        };
      }) || [];

      // Sort: alerts first, then online, then offline
friendsData.sort((a, b) => {
  if (a.isAlert && !b.isAlert) return -1;
  if (!a.isAlert && b.isAlert) return 1;
  if (a.isOnline && !b.isOnline) return -1;
  if (!a.isOnline && b.isOnline) return 1;
  return 0;
});

      setFriends(friendsData);
      setFilteredFriends(friendsData);
    } catch (error) {
      console.error('Failed to load friends:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste d\'amis');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFriends();
  };

  const calculateTimeAgo = (timestamp: string) => {
    const lastSeen = new Date(timestamp);
    const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000);
    
    if (minutesAgo < 1) return 'En ligne';
    else if (minutesAgo < 60) return `Vu il y a ${minutesAgo} min`;
    else if (minutesAgo < 1440) return `Vu il y a ${Math.floor(minutesAgo / 60)}h`;
    else return `Vu il y a ${Math.floor(minutesAgo / 1440)}j`;
  };

  const deleteFriend = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .or(`user_id.eq.${session?.user?.id},contact_id.eq.${session?.user?.id}`)
        .or(`user_id.eq.${friendId},contact_id.eq.${friendId}`);

      if (error) throw error;

      Alert.alert('Succès', 'Ami supprimé');
      loadFriends();
    } catch (error) {
      console.error('Failed to delete friend:', error);
      Alert.alert('Erreur', 'Impossible de supprimer cet ami');
    }
  };

  const confirmDeleteFriend = (friend: Friend) => {
    Alert.alert(
      'Supprimer cet ami ?',
      `Êtes-vous sûr de vouloir supprimer ${friend.full_name} de vos amis ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteFriend(friend.id)
        }
      ]
    );
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const statusText = item.isOnline 
      ? (item.lastSeen ? calculateTimeAgo(item.lastSeen) : 'En ligne')
      : 'Hors ligne';

    return (
      <TouchableOpacity 
        style={styles.friendItem} 
        activeOpacity={0.7}
        onLongPress={() => confirmDeleteFriend(item)}
      >
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
          <View
            style={[
              styles.onlineIndicator,
              {
                backgroundColor: item.isAlert
                  ? Colors.red
                  : item.isOnline
                  ? '#4CAF50'
                  : '#9E9E9E',
              },
            ]}
          />
        </View>
        
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.full_name}</Text>
          <View style={styles.statusContainer}>
            {item.isAlert && (
              <AntDesign name="warning" size={14} color={Colors.red} style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.friendStatus,
                { color: item.isAlert ? Colors.red : '#666' },
              ]}
            >
              {item.isAlert ? 'En alerte!' : statusText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => confirmDeleteFriend(item)}
          style={styles.deleteButton}
        >
          <MaterialIcons name="more-vert" size={24} color="#ccc" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un ami..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <AntDesign name="closecircle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.statText}>
            {friends.filter(f => f.isOnline && !f.isAlert).length} en ligne
          </Text>
        </View>
        {friends.filter(f => f.isAlert).length > 0 && (
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.red }]} />
            <Text style={styles.statText}>
              {friends.filter(f => f.isAlert).length} en alerte
            </Text>
          </View>
        )}
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#9E9E9E' }]} />
          <Text style={styles.statText}>
            {friends.filter(f => !f.isOnline).length} hors ligne
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require("@/assets/images/mammo_face_sat_no_bg.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>Aucun ami pour le moment</Text>
      <Text style={styles.emptySubtitle}>
        Ajoutez des amis pour voir leur statut
      </Text>
      <TouchableOpacity
        style={styles.addFriendButton}
        onPress={() => router.push("/add-friends")}
      >
        <AntDesign name="adduser" size={20} color="white" />
        <Text style={styles.addFriendButtonText}>Ajouter des amis</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Mes amis",
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
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/add-friends")}
              style={{ marginRight: 10 }}
            >
              <AntDesign name="adduser" size={24} color={Colors.orange} />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={styles.loadingText}>Chargement des amis...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.orange}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  listContent: {
    paddingTop: 100,
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  friendItem: {
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
    position: 'relative',
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
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendStatus: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  addFriendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});