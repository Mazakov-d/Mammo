import { Profile } from "./Profile";

export interface UserLocation {
  user_id: string; // UUID de l'utilisateur
  latitude: number; // Latitude GPS
  longitude: number; // Longitude GPS
  updated_at: string; // Dernière mise à jour (ISO timestamp)
  created_at?: string; // Date de création (ISO timestamp)
  
  // Relations optionnelles
  profiles?: Profile; // Profil de l'utilisateur (peut être null si non chargé)
  
  // Champs calculés (non stockés en DB)
  distance?: number; // Distance en km par rapport à l'utilisateur actuel
  isOnline?: boolean; // Si l'utilisateur a été vu dans les 30 dernières minutes
}