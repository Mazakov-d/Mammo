import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Contact } from "../types/Contact";

interface ContactsState {
  contacts: Contact[];
  friends: Contact[];
  sentRequests: Contact[];
  receivedRequests: Contact[];
  isLoading: boolean;
  error: string | null;
  fetchContacts: (userId: string) => Promise<void>;
  addContact: (
    userId: string,
    contactId: string,
    status: string
  ) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  isLoading: false,
  error: null,
  friends: [],
  sentRequests: [],
  receivedRequests: [],

  fetchContacts: async (userId: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from("contacts")
      .select(
        `
        *,
        profiles (
          id,
          full_name,
          first_name,
          last_name,
          avatar_url,
          updated_at
        )
      `
      )
      .or(`eq(user_id, ${userId}), eq(contact_id, ${userId})`);

    if (error) set({ error: error.message });
    else {
      set({ contacts: data as Contact[] });
      const friends = data?.filter((contact) => contact.status === "accepted") || [];
      const sentRequests = data?.filter(
        (contact) => contact.status === "pending" && contact.user_id === userId
      ) || [];
      const receivedRequests = data?.filter(
        (contact) => contact.status === "pending" && contact.contact_id === userId
      ) || [];
      set({friends, sentRequests, receivedRequests});
    }
    set({ isLoading: false });
  },

  addContact: async (userId: string, contactId: string, status: string) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase
      .from("contacts")
      .insert({ user_id: userId, contact_id: contactId, status });
    if (error) set({ error: error.message });
    set({ isLoading: false });
    await get().fetchContacts(userId);
  },

}));
