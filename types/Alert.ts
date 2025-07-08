export interface Alert {
  id: string; // UUID primary key
  creatorId: string; // UUID of the alert creator
  createdAt: string; // timestampz
  status: string; // e.g. 'open', 'resolved'
}
