// lib/locationTracker.ts

import { supabase } from './supabase';
import * as Location from 'expo-location';

export class LocationTracker {
  private locationSubscription: Location.LocationSubscription | null = null;

  /**
   * Démarre le suivi de localisation en avant-plan (lorsque l'app est ouverte)
   */
  async startTracking() {
    // Demande la permission d'accès à la localisation
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('📍 Permission de localisation refusée');
      return;
    }

    // Evite de créer plusieurs subscriptions
    if (this.locationSubscription) {
      console.log('⚠️ Le suivi de localisation est déjà actif');
      return;
    }

    // Lance watchPositionAsync pour recevoir des mises à jour régulières
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,       // toutes les 5 secondes
        distanceInterval: 0       // à chaque changement
      },
      this.handleLocationUpdate.bind(this)
    );

    console.log('🚀 Suivi de localisation démarré');
  }

  /**
   * Gère chaque nouvelle position reçue
   */
  private async handleLocationUpdate(location: Location.LocationObject) {
    const { latitude, longitude } = location.coords;

    try {
      // Récupère l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Met à jour la table user_locations avec upsert
      const { error } = await supabase
        .from('user_locations')
        .upsert(
          {
            user_id:    user.id,
            latitude,
            longitude,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('❌ Erreur lors de la mise à jour de la localisation :', error.message);
      } else {
        console.log(`✅ Localisation mise à jour : ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (err) {
      console.error('❌ Exception lors de la mise à jour de la localisation :', err);
    }
  }

  /**
   * Arrête le suivi de localisation
   */
  stopTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
      console.log('🛑 Suivi de localisation arrêté');
    } else {
      console.log('⚠️ Aucun suivi de localisation actif à arrêter');
    }
  }
}

// Export d'une instance unique
export const locationTracker = new LocationTracker();
