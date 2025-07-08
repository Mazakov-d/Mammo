import {create} from 'zustand'
import { supabase } from '../lib/supabase'
import { Contact } from '../types/Contact'

interface ContactsState {
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  fetchContacts: (userId: string) => Promise<void>;
  addContact: (userId: string, contactId: string, status: string) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  isLoading: false,
  error: null,

  fetchContacts: async (userId: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId);
    if (error) set({ error: error.message });
    else set({ contacts: data as Contact[] });
    set({ isLoading: false });
  },

  addContact: async (userId: string, contactId: string, status: string) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase
      .from('contacts')
      .insert({ user_id: userId, contact_id: contactId, status });
    if (error) set({ error: error.message });
    set({ isLoading: false });
    await get().fetchContacts(userId);
  },
}));