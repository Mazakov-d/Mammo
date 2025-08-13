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
import { useAuthStore } from "@/store/useAuthStore";
import { useContactsStore } from "@/store/useContactsStore";
import { Contact } from "@/types/Contact";
import { useAlertsStore } from "@/store/useAlertsStore";

interface Section {
  title: string;
  data: Contact[];
}

export default function UsersScreen() {
  const router = useRouter();
  const session = useAuthStore.getState().session;
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const {
    friends,
    isLoading,
    receivedInvitations,
    sentInvitations,
    fetchContacts,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
    deleteFriend,
    
  } = useContactsStore();

  const { alerts } = useAlertsStore();

  useEffect(() => {
    // Filter all sections based on search query
    if (searchQuery.trim() === "") {
      setFilteredSections(sections);
    } else {
      const filtered = sections
        .map((section) => ({
          ...section,
          data: section.data.filter((contact) =>
            contact.contactProfile.full_name
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((section) => section.data.length > 0);

      setFilteredSections(filtered);
    }
  }, [searchQuery, sections]);

  useEffect(() => {
  
    fillSections();
  }, [friends, receivedInvitations, sentInvitations]);

  const fillSections = async () => {
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
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchContacts().then(() => {
      setRefreshing(false);
    });
  };

  const confirmDeleteFriend = (contact: Contact) => {
    Alert.alert(
      "Supprimer cet ami ?",
      `Êtes-vous sûr de vouloir supprimer ${contact.contactProfile.full_name} de vos amis ?`,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteFriend(contact.contactProfile.id),
        },
      ]
    );
  };

  const confirmDeclineInvitation = (contact: Contact) => {
    Alert.alert(
      "Refuser cette invitation ?",
      `Êtes-vous sûr de vouloir refuser l'invitation de ${contact.contactProfile.full_name} ?`,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Refuser",
          style: "destructive",
          onPress: () => declineInvitation(contact.user_id),
        },
      ]
    );
  };

  const confirmCancelInvitation = (contact: Contact) => {
    Alert.alert(
      "Annuler cette invitation ?",
      `Êtes-vous sûr de vouloir annuler votre invitation à ${contact.contactProfile.full_name} ?`,
      [
        {
          text: "Non",
          style: "cancel",
        },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: () => cancelInvitation(contact.contactProfile.id),
        },
      ]
    );
  };

     const renderContact = ({ item }: { item: Contact }) => {
     const contact = item;
     const isUserOnAlert = alerts.some(
       (alert) => alert.creator_id === contact.contact_id
     );
     const sentInvitation =
       contact.status === "pending" && contact.user_id === session?.user.id;
     const receivedInvitation =
       contact.status === "pending" && contact.contact_id === session?.user.id;
     const displayedProfile = receivedInvitation ? contact.userProfile : contact.contactProfile;
 
     const renderActionButtons = () => {
      console.log("Rendering action buttons for:", contact.status);
      switch (contact.status) {
        case "accepted":
          return (
            <TouchableOpacity
              onPress={() => confirmDeleteFriend(contact)}
              style={styles.deleteButton}
            >
              <MaterialIcons name="more-vert" size={24} color="#ccc" />
            </TouchableOpacity>
          );

        case "pending":
          return (
            contact.contact_id === session?.user.id ? (
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: "#4CAF50", marginRight: 8 },
                  ]}
                  onPress={() => acceptInvitation(contact.user_id)}
                >
                  <MaterialIcons name="check" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#f44336" }]}
                  onPress={() => confirmDeclineInvitation(contact)}
                >
                  <MaterialIcons name="close" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#ff9800" }]}
                onPress={() => confirmCancelInvitation(contact)}
              >
                <MaterialIcons name="cancel" size={20} color="white" />
                <Text style={styles.actionButtonText}>Annuler</Text>
              </TouchableOpacity>
            )
          );

        default:
          return null;
      }
    };

    const renderStatusInfo = () => {
      if (contact.status === "accepted") {
        const isUserOnAlert = alerts.some(
          (alert) => alert.creator_id === contact.contact_id
        );
        return (
          <View style={styles.statusContainer}>
            {isUserOnAlert && (
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
                { color: isUserOnAlert ? Colors.red : "#666" },
              ]}
            >
              {isUserOnAlert && "En alerte!"}
            </Text>
          </View>
        );
             } else if (receivedInvitation) {
         return (
           <Text style={styles.invitationText}>
             Vous a envoyé une invitation
           </Text>
         );
       } else if (sentInvitation) {
         return <Text style={styles.pendingText}>En attente de réponse</Text>;
       }
      return null;
    };

    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.7}
        onLongPress={
          contact.status === "accepted"
            ? () => confirmDeleteFriend(contact)
            : undefined
        }
      >
        <View style={styles.avatarContainer}>
                     {displayedProfile.avatar_url ? (
             <Image
               source={{ uri: displayedProfile.avatar_url }}
               style={styles.avatar}
             />
           ) : (
             <View style={[styles.avatar, styles.defaultAvatar]}>
               <Text style={styles.avatarText}>
                 {displayedProfile.full_name.charAt(0).toUpperCase()}
               </Text>
             </View>
           )}
          {contact.status === "accepted" && (
            <View
              style={[
                styles.onlineIndicator,
                {
                  backgroundColor: isUserOnAlert ? Colors.red : undefined,
                },
              ]}
            />
          )}
        </View>

        <View style={styles.contactInfo}>
                     <Text style={styles.contactName}>{displayedProfile.full_name}</Text>
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

      {filteredSections.length === 0 && searchQuery === "" ? (
        renderEmpty()
      ) : (
        <SafeAreaView style={{ flex: 1 }}>
          {renderHeader()}

          <SectionList
            sections={filteredSections}
            renderItem={renderContact}
                         renderSectionHeader={renderSectionHeader}
             keyExtractor={(contact) => `${contact.user_id}-${contact.contact_id}`}
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
  contactItem: {
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
  contactInfo: {
    flex: 1,
  },
  contactName: {
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
