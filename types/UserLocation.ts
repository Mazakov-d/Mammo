export interface UserLocation {
  user_id: string; // UUID de l'utilisateur
  latitude: number; // Latitude GPS
  longitude: number; // Longitude GPS
  updated_at: string; // Dernière mise à jour (ISO timestamp)
  created_at?: string; // Date de création (ISO timestamp)
  
  // Relations optionnelles
  profiles?: {
    id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  
  // Champs calculés (non stockés en DB)
  distance?: number; // Distance en km par rapport à l'utilisateur actuel
  isOnline?: boolean; // Si l'utilisateur a été vu dans les 30 dernières minutes
}

// Type pour les mises à jour de localisation
export interface LocationUpdate {
  latitude: number;
  longitude: number;
}

// Type pour les filtres de recherche
export interface LocationFilters {
  isAlert?: boolean;
  maxDistance?: number; // En kilomètres
  onlyFriends?: boolean;
  onlyOnline?: boolean;
}