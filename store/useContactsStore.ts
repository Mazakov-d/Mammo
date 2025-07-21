import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Contact } from "../types/Contact";
import { useAuthStore } from "./useAuthStore";
import { RealtimeChannel, Session } from "@supabase/supabase-js";
import { Alert } from "react-native";

interface ContactsState {
  session: Session | null;
  contacts: Contact[];
  friends: Contact[];
  sentInvitations: Contact[];
  receivedInvitations: Contact[];
  isLoading: boolean;
  error: string | null;
  fetchContacts: () => Promise<void>;
  sendInvitation: (friendId: string) => Promise<void>;
  // subscribeToContactChanges: () => () => void;
  acceptInvitation: (contactId: string | undefined) => Promise<void>;
  declineInvitation: (contactId: string | undefined) => Promise<void>;
  cancelInvitation: (contactId: string | undefined) => Promise<void>;
  deleteFriend: (friendId: string | undefined) => Promise<void>;
  initializeSubscription: () => void;
  contactsChannel: RealtimeChannel | null;
  cleanupSubscription: () => void;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  isLoading: false,
  error: null,
  friends: [],
  sentInvitations: [],
  receivedInvitations: [],
  session: useAuthStore.getState().session,
  contactsChannel: null,

  fetchContacts: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) {
      set({ error: "No user ID found in session." });
      return Promise.resolve();
    }
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.from("contacts").select(
      `
        *,
        contactProfile:profiles!contact_id (
          id,
          full_name,
          first_name,
          last_name,
          avatar_url,
          updated_at
        )
      `
    );

    if (error) {
      console.error("Error fetching contacts:", JSON.stringify(error, null, 2));
      set({ error: error.message });
    } else {
      set({ contacts: data as Contact[] });
      console.log("Contacts length:", data?.length);
      const friends =
        data?.filter(
          (contact) =>
            contact.status === "accepted" && contact.user_id === userId
        ) || [];
      const sentInvitations =
        data?.filter(
          (contact) =>
            contact.status === "pending" && contact.user_id === userId
        ) || [];
      const receivedInvitations =
        data?.filter(
          (contact) =>
            contact.status === "pending" && contact.contact_id === userId
        ) || [];
      console.log("Friends length:", friends.length);
      set({ friends, sentInvitations, receivedInvitations });
    }
    set({ isLoading: false });
  },

  addContact: async (userId: string, contactId: string) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase
      .from("contacts")
      .insert({ user_id: userId, contact_id: contactId });
    if (error) set({ error: error.message });
    set({ isLoading: false });
    await get().fetchContacts();
  },

  sendInvitation: async (friendId: string) => {
    if (!get().session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: get().session?.user.id,
          contact_id: friendId,
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Succès', 'Demande d\'ami envoyée !');
      
      // Refresh search results
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande');
    }
  },

  acceptInvitation: async (contactId: string | undefined) => {
    if (!get().session?.user?.id) return;
    try {
      // Update the contact to accepted (trigger will create bidirectional relationship)
      const { error } = await supabase
        .from("contacts")
        .update({ status: "accepted" })
        .eq("user_id", contactId)
        .eq("contact_id", get().session?.user.id);

      if (error) throw error;

      Alert.alert("Succès", "Invitation acceptée !");
      get().fetchContacts();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      Alert.alert("Erreur", "Impossible d'accepter l'invitation");
    }
  },

  declineInvitation: async (contactId: string | undefined) => {
    if (!get().session?.user?.id) return;

    try {
      // Delete the invitation
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", contactId)
        .eq("contact_id", get().session?.user.id)
        .eq("status", "pending");

      if (error) throw error;

      Alert.alert("Succès", "Invitation refusée");
      get().fetchContacts();
    } catch (error) {
      console.error("Error declining invitation:", error);
      Alert.alert("Erreur", "Impossible de refuser l'invitation");
    }
  },

  cancelInvitation: async (contactId: string | undefined) => {
    if (!get().session?.user?.id) return;

    try {
      // Delete the sent invitation
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("user_id", get().session?.user.id)
        .eq("contact_id", contactId)
        .eq("status", "pending");

      if (error) throw error;

      Alert.alert("Succès", "Invitation annulée");
      get().fetchContacts();
    } catch (error) {
      console.error("Error canceling invitation:", error);
      Alert.alert("Erreur", "Impossible d'annuler l'invitation");
    }
  },

  deleteFriend: async (friendId: string | undefined) => {
    if (!get().session?.user?.id) return;

    try {
      // Use the safe deletion function
      const { data, error } = await supabase.rpc("delete_friendship_safe", {
        p_user_id: get().session?.user.id,
        p_contact_id: friendId,
      });

      if (error) {
        console.error("Safe delete function failed:", error);
        throw error;
      }

      const deletedCount = data?.[0]?.deleted_count || 0;
      console.log(`Deleted ${deletedCount} friendship records`);

      Alert.alert("Succès", "Ami supprimé");
      get().fetchContacts();
    } catch (error) {
      console.error("Failed to delete friend:", error);
      Alert.alert("Erreur", "Impossible de supprimer cet ami");
    }
  },

  initializeSubscription: () => {
    const state = get();

    if (!state.session?.user?.id || state.contactsChannel) {
      return;
    }

    const channel = supabase
      .channel(`contacts-changes-${state.session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
          // Pas besoin de filter, RLS s'en charge !
        },
        (payload) => {
          console.log("Contact change detected:", payload);
          get().fetchContacts();
        }
      )
      .subscribe();

    set({ contactsChannel: channel });
  },
  cleanupSubscription: () => {
    const { contactsChannel } = get();

    if (contactsChannel) {
      console.log("Cleaning up contacts subscription...");
      supabase.removeChannel(contactsChannel);
      set({ contactsChannel: null });
    }
  },
  // subscribeToContactChanges: () => {
  //   if (!get().session) {
  //     return () => {};
  //   }
  //   const subscription = supabase
  //     .channel("contacts_changes")
  //     .on(
  //       "postgres_changes",
  //       {
  //         event: "*",
  //         schema: "public",
  //         table: "contacts",
  //       },
  //       () => {
  //         // RLS s'applique automatiquement aussi aux subscriptions
  //         get().fetchContacts();
  //       }
  //     )
  //     .subscribe();

  //   return () => subscription.unsubscribe();
  // },
}));
