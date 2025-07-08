export interface Contact {
  userId: string; // UUID of the owner user
  contactId: string; // UUID of the contact user
  createdAt: string; // timestampz
  updatedAt: string; // timestampz
  status: string; // e.g. 'pending', 'accepted'
}
