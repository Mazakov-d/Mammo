// lib/renderOptimizationManager.ts - Efficient rendering and update system

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { UserLocation } from './locationTracker';

interface UserLocationNormalized {
  user_id: string;
  latitude: number;
  longitude: number;
  is_alert: boolean;
  last_seen: string;
  updated_at: string;
  full_name: string;
  avatar_url?: string;
  distance?: number;
  lastUpdateTime: number; // For efficient comparison
}

interface LocationUpdate {
  type: 'add' | 'update' | 'remove' | 'alert_change' | 'position_change';
  user_id: string;
  data?: UserLocationNormalized;
  previousData?: UserLocationNormalized;
}

interface RenderState {
  users: Map<string, UserLocationNormalized>;
  alertUsers: Set<string>;
  onlineUsers: Set<string>;
  lastUpdate: number;
  changeLog: LocationUpdate[];
}

class RenderOptimizationManager {
  private subscribers: Map<string, (updates: LocationUpdate[]) => void> = new Map();
  private previousState: Map<string, UserLocationNormalized> = new Map();
  private updateBatch: LocationUpdate[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_DELAY = 100; // Batch updates for 100ms

  // Normalize user location data for consistent comparison
  normalizeUserLocation(userLocation: UserLocation): UserLocationNormalized {
    return {
      user_id: userLocation.user_id,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      is_alert: userLocation.is_alert,
      last_seen: userLocation.last_seen,
      updated_at: userLocation.updated_at,
      full_name: userLocation.profiles?.full_name || 'Unknown User',
      avatar_url: userLocation.profiles?.avatar_url,
      distance: userLocation.distance,
      lastUpdateTime: new Date(userLocation.updated_at).getTime(),
    };
  }

  // Calculate incremental updates instead of full replacement
  calculateIncrementalUpdates(newLocations: UserLocation[]): LocationUpdate[] {
    const updates: LocationUpdate[] = [];
    const newUsersMap = new Map<string, UserLocationNormalized>();

    // Normalize new data
    newLocations.forEach(location => {
      const normalized = this.normalizeUserLocation(location);
      newUsersMap.set(normalized.user_id, normalized);
    });

    // Check for additions and updates
    for (const [userId, newUser] of newUsersMap.entries()) {
      const previousUser = this.previousState.get(userId);

      if (!previousUser) {
        // New user
        updates.push({
          type: 'add',
          user_id: userId,
          data: newUser,
        });
      } else {
        // Check for meaningful changes
        const hasChanges = this.hasSignificantChanges(previousUser, newUser);
        
        if (hasChanges.hasAlertChange) {
          updates.push({
            type: 'alert_change',
            user_id: userId,
            data: newUser,
            previousData: previousUser,
          });
        }
        
        if (hasChanges.hasPositionChange) {
          updates.push({
            type: 'position_change',
            user_id: userId,
            data: newUser,
            previousData: previousUser,
          });
        }
        
        if (hasChanges.hasOtherChanges) {
          updates.push({
            type: 'update',
            user_id: userId,
            data: newUser,
            previousData: previousUser,
          });
        }
      }
    }

    // Check for removals
    for (const [userId, previousUser] of this.previousState.entries()) {
      if (!newUsersMap.has(userId)) {
        updates.push({
          type: 'remove',
          user_id: userId,
          previousData: previousUser,
        });
      }
    }

    // Update previous state
    this.previousState = newUsersMap;

    return updates;
  }

  private hasSignificantChanges(
    previous: UserLocationNormalized, 
    current: UserLocationNormalized
  ): {
    hasAlertChange: boolean;
    hasPositionChange: boolean;
    hasOtherChanges: boolean;
  } {
    const alertChange = previous.is_alert !== current.is_alert;
    
    // Position change threshold: ~10 meters
    const latDiff = Math.abs(previous.latitude - current.latitude);
    const lngDiff = Math.abs(previous.longitude - current.longitude);
    const positionChange = latDiff > 0.0001 || lngDiff > 0.0001;
    
    const otherChanges = 
      previous.full_name !== current.full_name ||
      previous.avatar_url !== current.avatar_url ||
      Math.abs(previous.lastUpdateTime - current.lastUpdateTime) > 30000; // 30 seconds

    return {
      hasAlertChange: alertChange,
      hasPositionChange: positionChange,
      hasOtherChanges: otherChanges,
    };
  }

  // Batch updates to prevent excessive re-renders
  queueUpdates(updates: LocationUpdate[]) {
    if (updates.length === 0) return;

    this.updateBatch.push(...updates);

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Set new timeout for batched dispatch
    this.batchTimeout = setTimeout(() => {
      this.dispatchBatchedUpdates();
    }, this.BATCH_DELAY);
  }

  private dispatchBatchedUpdates() {
    if (this.updateBatch.length === 0) return;

    const batchToDispatch = [...this.updateBatch];
    this.updateBatch = [];

    console.log(`🔄 Dispatching ${batchToDispatch.length} batched updates`);

    // Notify all subscribers
    this.subscribers.forEach((callback) => {
      try {
        callback(batchToDispatch);
      } catch (error) {
        console.error('❌ Error in render optimization callback:', error);
      }
    });

    this.batchTimeout = null;
  }

  // Process new location data with optimization
  processLocationUpdates(newLocations: UserLocation[]) {
    const updates = this.calculateIncrementalUpdates(newLocations);
    
    if (updates.length > 0) {
      console.log(`📊 Processing ${updates.length} incremental updates:`, 
        updates.map(u => `${u.type}:${u.user_id}`).join(', '));
      
      this.queueUpdates(updates);
    }
  }

  // Subscribe to optimized updates
  subscribe(id: string, callback: (updates: LocationUpdate[]) => void): () => void {
    this.subscribers.set(id, callback);
    
    // Send initial state as "add" updates
    const initialUpdates: LocationUpdate[] = Array.from(this.previousState.values()).map(user => ({
      type: 'add' as const,
      user_id: user.user_id,
      data: user,
    }));

    if (initialUpdates.length > 0) {
      setTimeout(() => callback(initialUpdates), 0);
    }

    return () => {
      this.subscribers.delete(id);
    };
  }

  // Get current state snapshot
  getCurrentState(): UserLocationNormalized[] {
    return Array.from(this.previousState.values());
  }

  // Clear all state
  reset() {
    this.previousState.clear();
    this.updateBatch = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  // Get statistics for debugging
  getStats() {
    return {
      totalUsers: this.previousState.size,
      subscriberCount: this.subscribers.size,
      pendingUpdates: this.updateBatch.length,
      hasPendingBatch: !!this.batchTimeout,
    };
  }
}

// Create singleton instance
export const renderOptimizationManager = new RenderOptimizationManager();

// Optimized React hooks for efficient rendering

export function useOptimizedUserLocations(locations: UserLocation[]) {
  const [optimizedState, setOptimizedState] = useState<RenderState>({
    users: new Map(),
    alertUsers: new Set(),
    onlineUsers: new Set(),
    lastUpdate: 0,
    changeLog: [],
  });

  const subscriptionId = useRef(`sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);

  useEffect(() => {
    // Subscribe to optimized updates
    const unsubscribe = renderOptimizationManager.subscribe(
      subscriptionId.current,
      (updates) => {
        setOptimizedState(prevState => {
          const newUsers = new Map(prevState.users);
          const newAlertUsers = new Set(prevState.alertUsers);
          const newOnlineUsers = new Set(prevState.onlineUsers);

          // Apply incremental updates
          updates.forEach(update => {
            switch (update.type) {
              case 'add':
                if (update.data) {
                  newUsers.set(update.user_id, update.data);
                  newOnlineUsers.add(update.user_id);
                  if (update.data.is_alert) {
                    newAlertUsers.add(update.user_id);
                  }
                }
                break;

              case 'update':
                if (update.data) {
                  newUsers.set(update.user_id, update.data);
                  if (update.data.is_alert) {
                    newAlertUsers.add(update.user_id);
                  } else {
                    newAlertUsers.delete(update.user_id);
                  }
                }
                break;

              case 'alert_change':
                if (update.data) {
                  newUsers.set(update.user_id, update.data);
                  if (update.data.is_alert) {
                    newAlertUsers.add(update.user_id);
                  } else {
                    newAlertUsers.delete(update.user_id);
                  }
                }
                break;

              case 'position_change':
                if (update.data) {
                  newUsers.set(update.user_id, update.data);
                }
                break;

              case 'remove':
                newUsers.delete(update.user_id);
                newAlertUsers.delete(update.user_id);
                newOnlineUsers.delete(update.user_id);
                break;
            }
          });

          return {
            users: newUsers,
            alertUsers: newAlertUsers,
            onlineUsers: newOnlineUsers,
            lastUpdate: Date.now(),
            changeLog: updates,
          };
        });
      }
    );

    return unsubscribe;
  }, []);

  // Process new locations when they change
  useEffect(() => {
    renderOptimizationManager.processLocationUpdates(locations);
  }, [locations]);

  // Memoized derived state
  const derivedState = useMemo(() => {
    const usersArray = Array.from(optimizedState.users.values());
    
    return {
      allUsers: usersArray,
      alertUsers: usersArray.filter(user => optimizedState.alertUsers.has(user.user_id)),
      onlineUsers: usersArray.filter(user => optimizedState.onlineUsers.has(user.user_id)),
      userCount: optimizedState.users.size,
      alertCount: optimizedState.alertUsers.size,
      onlineCount: optimizedState.onlineUsers.size,
      lastUpdate: optimizedState.lastUpdate,
      recentChanges: optimizedState.changeLog,
    };
  }, [optimizedState.users, optimizedState.alertUsers, optimizedState.onlineUsers, optimizedState.lastUpdate]);

  return derivedState;
}

// Optimized marker rendering hook
export function useOptimizedMarkers(
  users: UserLocationNormalized[],
  currentUserId?: string,
  renderMarker?: (user: UserLocationNormalized) => React.ReactNode
) {
  const markersRef = useRef<Map<string, React.ReactNode>>(new Map());
  const [markerVersion, setMarkerVersion] = useState(0);

  const optimizedMarkers = useMemo(() => {
    let hasChanges = false;
    const newMarkers = new Map<string, React.ReactNode>();

    users.forEach(user => {
      if (user.user_id === currentUserId) return; // Skip current user

      const existingMarker = markersRef.current.get(user.user_id);
      const userKey = `${user.user_id}_${user.lastUpdateTime}_${user.is_alert}`;
      
      // Check if we need to re-render this marker
      const needsUpdate = !existingMarker || 
        !markersRef.current.has(userKey);

      if (needsUpdate || !existingMarker) {
        const newMarker = renderMarker ? renderMarker(user) : null;
        newMarkers.set(user.user_id, newMarker);
        hasChanges = true;
      } else {
        newMarkers.set(user.user_id, existingMarker);
      }
    });

    // Remove markers for users no longer present
    markersRef.current.forEach((marker, userId) => {
      if (!users.find(u => u.user_id === userId)) {
        hasChanges = true;
      }
    });

    if (hasChanges) {
      markersRef.current = newMarkers;
      setMarkerVersion(v => v + 1);
    }

    return Array.from(newMarkers.values()).filter(Boolean);
  }, [users, currentUserId, renderMarker, markerVersion]);

  return optimizedMarkers;
}

// Optimized contacts list hook
export function useOptimizedContactsList(
  contacts: any[],
  searchQuery: string = ''
) {
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim() === '') {
        setFilteredContacts(contacts);
      } else {
        const filtered = contacts.filter(contact =>
          contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredContacts(filtered);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [contacts, searchQuery]);

  // Memoized sections for SectionList
  const contactSections = useMemo(() => {
    const sections: { title: string; data: any[] }[] = [];
    
    const friends = filteredContacts.filter(c => c.type === 'friend');
    const received = filteredContacts.filter(c => c.type === 'received');
    const sent = filteredContacts.filter(c => c.type === 'sent');

    if (friends.length > 0) {
      sections.push({
        title: `Mes amis (${friends.length})`,
        data: friends,
      });
    }

    if (received.length > 0) {
      sections.push({
        title: `Invitations reçues (${received.length})`,
        data: received,
      });
    }

    if (sent.length > 0) {
      sections.push({
        title: `Invitations envoyées (${sent.length})`,
        data: sent,
      });
    }

    return sections;
  }, [filteredContacts]);

  return {
    filteredContacts,
    contactSections,
    totalCount: filteredContacts.length,
    friendCount: filteredContacts.filter(c => c.type === 'friend').length,
    receivedCount: filteredContacts.filter(c => c.type === 'received').length,
    sentCount: filteredContacts.filter(c => c.type === 'sent').length,
  };
}

// Optimized state selector hooks
export function useAppStateSelector<T>(
  selector: (state: any) => T,
  dependencies: React.DependencyList = []
): T {
  const [selectedState, setSelectedState] = useState<T>();
  const selectorRef = useRef(selector);
  const prevDepsRef = useRef(dependencies);

  // Update selector if dependencies change
  useEffect(() => {
    const depsChanged = dependencies.some(
      (dep, index) => dep !== prevDepsRef.current[index]
    );
    
    if (depsChanged) {
      selectorRef.current = selector;
      prevDepsRef.current = dependencies;
    }
  }, dependencies);

  return selectedState as T;
}

// Performance monitoring hook
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    if (renderCount.current % 10 === 0) { // Log every 10 renders
      console.log(`📊 ${componentName} rendered ${renderCount.current} times. Last render: ${timeSinceLastRender}ms ago`);
    }
    
    lastRenderTime.current = now;
  });

  return {
    renderCount: renderCount.current,
    timeSinceLastRender: Date.now() - lastRenderTime.current,
  };
}

// Optimized callback hook with stable reference
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);
  const depsRef = useRef(deps);

  // Update callback only if dependencies actually changed
  const depsChanged = deps.some((dep, index) => 
    !Object.is(dep, depsRef.current[index])
  );

  if (depsChanged) {
    callbackRef.current = callback;
    depsRef.current = deps;
  }

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}