import { useEffect } from 'react';
import { useContactsStore } from '../store/useContactsStore';
import { useAuthStore } from '../store/useAuthStore';

export const useInitContacts = () => {
  const session = useAuthStore((state) => state.session);
  const { fetchContacts, initializeSubscription, cleanupSubscription } = useContactsStore();
  
  useEffect(() => {
    if (session?.user?.id) {
      fetchContacts();
      initializeSubscription();
      
      return () => {
        cleanupSubscription();
      };
    }
  }, [session?.user?.id]);
};