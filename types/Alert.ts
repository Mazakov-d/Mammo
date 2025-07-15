export interface Alert {
  id: string; // UUID primary key
  creator_id: string; // UUID of the alert creator
  created_at: string; // timestampz
  status: string; // e.g. 'open', 'resolved'
}
