export interface Profile {
  id: string; // UUID of the owner user
  created_at: string; // timestamp with time zone
  full_name: string; // Full name of the user
  birthday: string; // Date of birth
  avatar_url: string; // URL of the user's avatar
  first_name: string; // First name of the user
  last_name: string; // Last name of the user
  updated_at: string; // Last update timestamp with time zone
  alert_group_id: string | null;
}
