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
  SectionList,
  SafeAreaView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";

interface Person {
  id: string;
  full_name: string;
  avatar_url?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isAlert?: boolean;
  type: "friend" | "received" | "sent";
}

interface Section {
  title: string;
  data: Person[];
}

export default function UsersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllRelationships();

    // Subscribe to relationships changes
    const relationshipsSubscription = supabase
      .channel("relationships_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
        },
        () => {
          loadAllRelationships();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_locations",
        },
        () => {
          loadAllRelationships();
        }
      )
      .subscribe();

    return () => {
      relationshipsSubscription.unsubscribe();
    };
  }, [session?.user?.id]);

  useEffect(() => {
    // Filter all sections based on search query
    if (searchQuery.trim() === "") {
      setFilteredSections(sections);
    } else {
      const filtered = sections
        .map((section) => ({
          ...section,
          data: section.data.filter((person) =>
            person.full_name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((section) => section.data.length > 0);

      setFilteredSections(filtered);
    }
  }, [searchQuery, sections]);

  const loadAllRelationships = async () => {
    try {
      setLoading(true);

      if (!session?.user?.id) return;

      // Load friends (only search where user_id = current user)
      const friends = await loadFriends();

      // Load received invitations (where contact_id = current user and status = pending)
      const receivedInvitations = await loadReceivedInvitations();

      // Load sent invitations (where user_id = current user and status = pending)
      const sentInvitations = await loadSentInvitations();

      const newSections: Section[] = [];

      if (friends.length > 0) {
        newSections.push({
          title: `Mes amis (${friends.length})`,
          data: friends,
        });
      }

      if (receivedInvitations.length > 0) {
        newSections.push({
          title: `Invitations reçues (${receivedInvitations.length})`,
          data: receivedInvitations,
        });
      }

      if (sentInvitations.length > 0) {
        newSections.push({
          title: `Invitations envoyées (${sentInvitations.length})`,
          data: sentInvitations,
        });
      }

      setSections(newSections);
      setFilteredSections(newSections);
    } catch (error) {
      console.error("Failed to load relationships:", error);
      Alert.alert("Erreur", "Impossible de charger les relations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFriends = async (): Promise<Person[]> => {
    if (!session?.user?.id) return [];

    // Get accepted contacts where current user is user_id
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("contact_id")
      .eq("user_id", session.user.id)
      .eq("status", "accepted");

    if (contactsError) throw contactsError;

    const friendIds = contacts?.map((contact) => contact.contact_id) || [];

    if (friendIds.length === 0) return [];

    // Get friend profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", friendIds);

    if (profilesError) throw profilesError;

    // Get online status from user_locations
    const thirtyMinutesAgo = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString();
    const { data: locations, error: locationsError } = await supabase
      .from("user_locations")
      .select("user_id, is_alert, updated_at")
      .in("user_id", friendIds)
      .gte("updated_at", thirtyMinutesAgo);

    if (locationsError) throw locationsError;

    // Combine data
    const friendsData: Person[] =
      profiles?.map((profile) => {
        const location = locations?.find((loc) => loc.user_id === profile.id);
        const isOnline = !!location;

        return {
          id: profile.id,
          full_name: profile.full_name || "Sans nom",
          avatar_url: profile.avatar_url,
          isOnline,
          lastSeen: location?.updated_at,
          isAlert: location?.is_alert || false,
          type: "friend",
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

    return friendsData;
  };

  const loadReceivedInvitations = async (): Promise<Person[]> => {
    if (!session?.user?.id) return [];

    try {
      // Get pending invitations where current user is contact_id
      const { data: invitations, error: invitationsError } = await supabase
        .from("contacts")
        .select("user_id")
        .eq("contact_id", session.user.id)
        .eq("status", "pending");

      if (invitationsError) {
        console.error("Error fetching invitations:", invitationsError);
        throw invitationsError;
      }

      if (!invitations || invitations.length === 0) return [];

      // Get profiles for the users who sent invitations
      const userIds = invitations.map((inv) => inv.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      return (
        profiles?.map((profile) => ({
          id: profile.id,
          full_name: profile.full_name || "Sans nom",
          avatar_url: profile.avatar_url,
          type: "received" as const,
        })) || []
      );
    } catch (error) {
      console.error("Error loading received invitations:", error);
      return [];
    }
  };

  const loadSentInvitations = async (): Promise<Person[]> => {
    if (!session?.user?.id) return [];

    try {
      // Get pending invitations where current user is user_id
      const { data: invitations, error: invitationsError } = await supabase
        .from("contacts")
        .select("contact_id")
        .eq("user_id", session.user.id)
        .eq("status", "pending");

      if (invitationsError) {
        console.error("Error fetching sent invitations:", invitationsError);
        throw invitationsError;
      }

      if (!invitations || invitations.length === 0) return [];

      // Get profiles for the users who received invitations
      const contactIds = invitations.map((inv) => inv.contact_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", contactIds);

      if (profilesError) {
        console.error("Error fetching contact profiles:", profilesError);
        throw profilesError;
      }

      return (
        profiles?.map((profile) => ({
          id: profile.id,
          full_name: profile.full_name || "Sans nom",
          avatar_url: profile.avatar_url,
          type: "sent" as const,
        })) || []
      );
    } catch (error) {
      console.error("Error loading sent invitations:", error);
      return [];
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllRelationships();
  };

  const calculateTimeAgo = (timestamp: string) => {
    const lastSeen = new Date(timestamp);
    const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000);

    if (minutesAgo < 1) return "En ligne";
    else if (minutesAgo < 60) return `Vu il y a ${minutesAgo} min`;
    else if (minutesAgo < 1440)
      return `Vu il y a ${Math.floor(minutesAgo / 60)}h`;
    else return `Vu il y a ${Math.floor(minutesAgo / 1440)}j`;
  };

  const acceptInvitation = async (personId: string) => {
    if (!session?.user?.id) return;

    try {
      // Update the request to accepted (trigger will create bidirectional relationship)
      const { error } = await supabase
        .from("contacts")
        .update({ status: "accepted" })
        .eq("user_id", personId)
        .eq("contact_id", session.user.id);

      if (error) throw error;

      Alert.alert("Succès", "Invitation acceptée !");
      loadAllRelationships();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      Alert.alert("Erreur", "Impossible d'accepter l'invitation");
    }
  };

  const declineInvitation = async (personId: string) => {
    if (!session?.user?.id) return;

    try {
      // Delete the invitation
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", personId)
        .eq("contact_id", session.user.id)
        .eq("status", "pending");

      if (error) throw error;

      Alert.alert("Succès", "Invitation refusée");
      loadAllRelationships();
    } catch (error) {
      console.error("Error declining invitation:", error);
      Alert.alert("Erreur", "Impossible de refuser l'invitation");
    }
  };

  const cancelInvitation = async (personId: string) => {
    if (!session?.user?.id) return;

    try {
      // Delete the sent invitation
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", session.user.id)
        .eq("contact_id", personId)
        .eq("status", "pending");

      if (error) throw error;

      Alert.alert("Succès", "Invitation annulée");
      loadAllRelationships();
    } catch (error) {
      console.error("Error canceling invitation:", error);
      Alert.alert("Erreur", "Impossible d'annuler l'invitation");
    }
  };

  const deleteFriend = async (friendId: string) => {
    if (!session?.user?.id) return;

    try {
      // Use the safe deletion function
      const { data, error } = await supabase.rpc("delete_friendship_safe", {
        p_user_id: session.user.id,
        p_contact_id: friendId,
      });

      if (error) {
        console.error("Safe delete function failed:", error);
        throw error;
      }

      const deletedCount = data?.[0]?.deleted_count || 0;
      console.log(`Deleted ${deletedCount} friendship records`);

      Alert.alert("Succès", "Ami supprimé");
      loadAllRelationships();
    } catch (error) {
      console.error("Failed to delete friend:", error);
      Alert.alert("Erreur", "Impossible de supprimer cet ami");
    }
  };

  const confirmDeleteFriend = (person: Person) => {
    Alert.alert(
      "Supprimer cet ami ?",
      `Êtes-vous sûr de vouloir supprimer ${person.full_name} de vos amis ?`,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteFriend(person.id),
        },
      ]
    );
  };

  const confirmDeclineInvitation = (person: Person) => {
    Alert.alert(
      "Refuser cette invitation ?",
      `Êtes-vous sûr de vouloir refuser l'invitation de ${person.full_name} ?`,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Refuser",
          style: "destructive",
          onPress: () => declineInvitation(person.id),
        },
      ]
    );
  };

  const confirmCancelInvitation = (person: Person) => {
    Alert.alert(
      "Annuler cette invitation ?",
      `Êtes-vous sûr de vouloir annuler votre invitation à ${person.full_name} ?`,
      [
        {
          text: "Non",
          style: "cancel",
        },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: () => cancelInvitation(person.id),
        },
      ]
    );
  };

  const renderPerson = ({ item }: { item: Person }) => {
    const renderActionButtons = () => {
      switch (item.type) {
        case "friend":
          return (
            <TouchableOpacity
              onPress={() => confirmDeleteFriend(item)}
              style={styles.deleteButton}
            >
              <MaterialIcons name="more-vert" size={24} color="#ccc" />
            </TouchableOpacity>
          );

        case "received":
          return (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: "#4CAF50", marginRight: 8 },
                ]}
                onPress={() => acceptInvitation(item.id)}
              >
                <MaterialIcons name="check" size={20} color="white" />
                <Text style={styles.actionButtonText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#f44336" }]}
                onPress={() => confirmDeclineInvitation(item)}
              >
                <MaterialIcons name="close" size={20} color="white" />
                <Text style={styles.actionButtonText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          );

        case "sent":
          return (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#ff9800" }]}
              onPress={() => confirmCancelInvitation(item)}
            >
              <MaterialIcons name="cancel" size={20} color="white" />
              <Text style={styles.actionButtonText}>Annuler</Text>
            </TouchableOpacity>
          );

        default:
          return null;
      }
    };

    const renderStatusInfo = () => {
      if (item.type === "friend") {
        const statusText = item.isOnline
          ? item.lastSeen
            ? calculateTimeAgo(item.lastSeen)
            : "En ligne"
          : "Hors ligne";

        return (
          <View style={styles.statusContainer}>
            {item.isAlert && (
              <AntDesign
                name="warning"
                size={14}
                color={Colors.red}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.friendStatus,
                { color: item.isAlert ? Colors.red : "#666" },
              ]}
            >
              {item.isAlert ? "En alerte!" : statusText}
            </Text>
          </View>
        );
      } else if (item.type === "received") {
        return (
          <Text style={styles.invitationText}>
            Vous a envoyé une invitation
          </Text>
        );
      } else if (item.type === "sent") {
        return <Text style={styles.pendingText}>En attente de réponse</Text>;
      }
      return null;
    };

    return (
      <TouchableOpacity
        style={styles.personItem}
        activeOpacity={0.7}
        onLongPress={
          item.type === "friend" ? () => confirmDeleteFriend(item) : undefined
        }
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
          {item.type === "friend" && (
            <View
              style={[
                styles.onlineIndicator,
                {
                  backgroundColor: item.isAlert
                    ? Colors.red
                    : item.isOnline
                    ? "#4CAF50"
                    : "#9E9E9E",
                },
              ]}
            />
          )}
        </View>

        <View style={styles.personInfo}>
          <Text style={styles.personName}>{item.full_name}</Text>
          {renderStatusInfo()}
        </View>

        {renderActionButtons()}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Feather
          name="search"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
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

      {filteredSections.length > 0 && (
        <View style={styles.statsContainer}>
          {filteredSections.map((section, index) => {
            let color = "#4CAF50";
            if (section.title.includes("reçues")) color = "#2196F3";
            if (section.title.includes("envoyées")) color = "#FF9800";

            return (
              <View key={index} style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: color }]} />
                <Text style={styles.statText}>{section.title}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require("@/assets/images/mammo_face_sat_no_bg.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>Aucune relation pour le moment</Text>
      <Text style={styles.emptySubtitle}>
        Ajoutez des amis pour voir leur statut
      </Text>
      <TouchableOpacity
        style={styles.addFriendButton}
        onPress={() => router.push("/contacts/add-contacts")}
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
          headerTitle: "Mes relations",
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
              onPress={() => router.push("/contacts/add-contacts")}
              style={{ marginRight: 10 }}
            >
              <AntDesign name="adduser" size={24} color={Colors.orange} />
            </TouchableOpacity>
          ),
        }}
      />

      {filteredSections.length === 0 ? (
        renderEmpty()
      ) : (
        <SafeAreaView style={{ flex: 1 }}>
          {renderHeader()}
        
          <SectionList
            sections={filteredSections}
            renderItem={renderPerson}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.orange}
              />
            }
            stickySectionHeadersEnabled={false}
          />
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: Colors.orange,
    fontSize: 16,
  },
  listContent: {
    // paddingTop: 100,
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: "#000",
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
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statText: {
    fontSize: 14,
    color: "#666",
  },
  sectionHeader: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.primary,
  },
  personItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendStatus: {
    fontSize: 14,
    color: "#666",
  },
  invitationText: {
    fontSize: 14,
    color: "#2196F3",
    fontStyle: "italic",
  },
  pendingText: {
    fontSize: 14,
    color: "#FF9800",
    fontStyle: "italic",
  },
  buttonGroup: {
    flexDirection: "row",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.orange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  addFriendButton: {
    flexDirection: "row",
    alignItems: "center",
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
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
