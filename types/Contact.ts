import { Profile } from "./Profile";

export interface Contact {
  user_id: string; // UUID of the owner user
  contact_id: string; // UUID of the contact user
  created_at: string; // timestampz
  updated_at: string; // timestampz
  status: string; // e.g. 'pending', 'accepted'
  profiles?: Profile; // Optional profile information of the contact
}
