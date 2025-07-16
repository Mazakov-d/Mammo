import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { UserLocation } from '../types/UserLocation';
import { LocationObject } from 'expo-location';

interface LocationState {
  myLocation: LocationObject | null;
  userLocations: UserLocation[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchVisibleLocations: () => Promise<void>;
  subscribeToLocationChanges: () => () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  myLocation: null,
  userLocations: [],
  isLoading: false,
  error: null,

  // Version ultra-simplifiée grâce à RLS
  fetchVisibleLocations: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Une seule requête ! RLS fait tout le filtrage automatiquement
      const { data: locations, error } = await supabase
        .from('user_locations')
        .select(`
          *,
          profiles (
            id,
            full_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Traitement local minimal
      const processedData = (locations || []).map(location => ({
        ...location,
      }));

      set({
        userLocations: processedData,
        isLoading: false
      });
    } catch (error: any) {
      console.error('Erreur fetchVisibleLocations:', error);
      set({
        error: error.message || 'Erreur lors de la récupération des localisations',
        isLoading: false
      });
    }
  },

  subscribeToLocationChanges: () => {
    const subscription = supabase
      .channel('location_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations'
        },
        () => {
          // RLS s'applique automatiquement aussi aux subscriptions
          get().fetchVisibleLocations();
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }
}));