// lib/locationTracker.ts - Complete version with visibility rules

import { supabase } from './supabase';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface UserLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  is_alert: boolean;
  last_seen: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

class LocationTracker {
  private lastKnownLocation: LocationState | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundInterval: ReturnType<typeof setInterval> | null = null;
  private isAlertMode: boolean = false;
  private isActive: boolean = false;
  private realtimeSubscription: any = null;

  // Configuration
  private readonly CONFIG = {
    BACKGROUND_MODE: {
      timeInterval: 15 * 60 * 1000,    // 15 minutes
      accuracy: Location.Accuracy.Balanced,
      maxAge: 2 * 60 * 1000           // 2 minutes max age
    },
    ALERT_MODE: {
      distanceInterval: 5,               // 5 meters movement
      accuracy: Location.Accuracy.High,
      maxAge: 10 * 1000               // 10 seconds max age
    }
  };

  async startTracking(isAlert: boolean = false) {
    // Prevent multiple starts
    if (this.isActive) {
      console.log('⚠️ Location tracking is already active');
      return;
    }

    this.isAlertMode = isAlert;
    this.isActive = true;

    console.log(`🚀 Starting tracking - ${isAlert ? 'ALERT' : 'BACKGROUND'} mode`);

    // Request permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      this.isActive = false;
      throw new Error('Location permission denied');
    }

    if (isAlert) {
      // ALERT MODE: Movement-based tracking (every 5 meters)
      await this.startAlertTracking();
    } else {
      // BACKGROUND MODE: Time-based updates (every 15 minutes)
      await this.startBackgroundTracking();
    }

    // Send immediate location update when starting
    await this.sendImmediateUpdate();
  }

  async stopTracking() {
    if (!this.isActive) {
      console.log('⚠️ Location tracking is not active');
      return;
    }

    console.log('🛑 Stopping location tracking');
    this.isActive = false;

    // Stop movement tracking
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // Stop background interval
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    // Don't remove from map - keep location stored
    console.log('📍 Location kept in database');
  }

  private async startBackgroundTracking() {
    console.log('📅 Starting background mode - updates every 15 minutes');
    
    // Clear any existing interval
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }

    this.backgroundInterval = setInterval(async () => {
      if (!this.isActive) return;

      try {
        console.log('⏰ Background update triggered');
        await this.sendLocationUpdate('background');
      } catch (error) {
        console.error('❌ Background update failed:', error);
      }
    }, this.CONFIG.BACKGROUND_MODE.timeInterval);
  }

  private async startAlertTracking() {
    console.log('🚨 Starting alert mode - tracking every 5 meters movement');

    // Remove any existing subscription
    if (this.locationSubscription) {
      this.locationSubscription.remove();
    }

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: this.CONFIG.ALERT_MODE.accuracy,
        timeInterval: 2000,        // Check every 2 seconds
        distanceInterval: this.CONFIG.ALERT_MODE.distanceInterval, // Update every 5 meters
      },
      async (location) => {
        console.log('📍 Movement detected in alert mode:', 
          location.coords.latitude.toFixed(6), 
          location.coords.longitude.toFixed(6)
        );
        await this.handleLocationUpdate(location, 'alert');
      }
    );
  }

  private async sendImmediateUpdate() {
    try {
      console.log('⚡ Sending immediate location update');
      await this.sendLocationUpdate('immediate');
    } catch (error) {
      console.error('❌ Immediate update failed:', error);
    }
  }

  private async sendLocationUpdate(source: 'background' | 'alert' | 'immediate') {
    try {
      const config = this.isAlertMode ? this.CONFIG.ALERT_MODE : this.CONFIG.BACKGROUND_MODE;
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: config.accuracy,
        // maximumAge: config.maxAge,
      });

      await this.handleLocationUpdate(location, source);
    } catch (error) {
      console.error(`❌ Failed to get location for ${source}:`, error);
    }
  }

  private async handleLocationUpdate(location: Location.LocationObject, source: string) {
    const newLocation: LocationState = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now()
    };

    await this.updateLocationInDatabase(newLocation, source);
    this.lastKnownLocation = newLocation;
  }

  private async updateLocationInDatabase(location: LocationState, source: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No authenticated user');
        return;
      }

      const { error } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          is_alert: this.isAlertMode,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Database update error:', error);
        return;
      }

      console.log(`✅ Location updated (${source}):`, 
        location.latitude.toFixed(6), 
        location.longitude.toFixed(6),
        this.isAlertMode ? '🚨 ALERT' : '📱 Background'
      );
    } catch (error) {
      console.error('❌ Failed to update location in database:', error);
    }
  }

  async switchToAlertMode() {
    if (this.isAlertMode) {
      console.log('⚠️ Already in alert mode');
      return;
    }

    console.log('🚨 Switching to ALERT mode');
    this.isAlertMode = true;

    // Stop background tracking
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    // Start movement-based tracking
    await this.startAlertTracking();
    
    // Send immediate update with alert status
    await this.sendImmediateUpdate();
  }

  async switchToBackgroundMode() {
    if (!this.isAlertMode) {
      console.log('⚠️ Already in background mode');
      return;
    }

    console.log('📱 Switching to BACKGROUND mode');
    this.isAlertMode = false;

    // Stop movement tracking
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // Start background tracking
    await this.startBackgroundTracking();
    
    // Send immediate update to remove alert status
    await this.sendImmediateUpdate();
  }

  // Public methods for your app
  async activateAlert() {
    await this.switchToAlertMode();
  }

  async deactivateAlert() {
    await this.switchToBackgroundMode();
  }

  // Get visible user locations based on visibility rules:
  // - If user is in alert mode (is_alert = true): visible to everyone
  // - If user is NOT in alert mode (is_alert = false): visible only to friends
  async getVisibleUserLocations(): Promise<UserLocation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // First, get all users in alert mode (visible to everyone)
      const { data: alertUsers, error: alertError } = await supabase
        .from('user_locations')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('is_alert', true)
        .gte('updated_at', thirtyMinutesAgo);

      if (alertError) {
        console.error('❌ Failed to get alert users:', alertError);
        return [];
      }

      // Then, get friends who are NOT in alert mode
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .or(`user_id.eq.${user.id},contact_id.eq.${user.id}`);

      if (contactsError) {
        console.error('❌ Failed to get contacts:', contactsError);
        return alertUsers || [];
      }

      // Extract friend IDs
      const friendIds = contacts?.map(contact => 
        contact.user_id === user.id ? contact.contact_id : contact.user_id
      ) || [];

      // Add current user to see themselves
      friendIds.push(user.id);

      // Get friends' locations who are NOT in alert mode
      const { data: friendLocations, error: friendsError } = await supabase
        .from('user_locations')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .in('user_id', friendIds)
        .eq('is_alert', false)
        .gte('updated_at', thirtyMinutesAgo);

      if (friendsError) {
        console.error('❌ Failed to get friend locations:', friendsError);
        return alertUsers || [];
      }

      // Combine alert users (visible to all) and friends (not in alert)
      const allVisibleUsers = [...(alertUsers || []), ...(friendLocations || [])];
      
      // Remove duplicates (in case a friend is also in alert mode)
      const uniqueUsers = allVisibleUsers.filter((user, index, self) =>
        index === self.findIndex((u) => u.user_id === user.user_id)
      );

      // Sort: alerts first, then by last update
      uniqueUsers.sort((a, b) => {
        if (a.is_alert && !b.is_alert) return -1;
        if (!a.is_alert && b.is_alert) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      console.log(`👀 Visible users: ${uniqueUsers.length} (${alertUsers?.length || 0} alerts, ${friendLocations?.length || 0} friends)`);
      return uniqueUsers;
    } catch (error) {
      console.error('❌ Failed to load visible user locations:', error);
      return [];
    }
  }

  // Subscribe to real-time location changes with visibility rules
  subscribeToVisibleLocationChanges(callback: (locations: UserLocation[]) => void) {
    // Unsubscribe from existing subscription if any
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    this.realtimeSubscription = supabase
      .channel('visible_locations_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations'
        },
        async (payload) => {
          console.log('📍 Real-time location change detected');
          const locations = await this.getVisibleUserLocations();
          callback(locations);
        }
      )
      // Also listen to contacts changes to update when friends are added/removed
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        async (payload) => {
          console.log('👥 Real-time contacts change detected');
          const locations = await this.getVisibleUserLocations();
          callback(locations);
        }
      )
      .subscribe();

    return this.realtimeSubscription;
  }

  // Get friends' locations only (for friends list screen)
  async getFriendsLocations(): Promise<UserLocation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all contacts where current user is either user_id or contact_id
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .or(`user_id.eq.${user.id},contact_id.eq.${user.id}`);

      if (contactsError) throw contactsError;

      // Extract friend IDs
      const friendIds = contacts?.map(contact => 
        contact.user_id === user.id ? contact.contact_id : contact.user_id
      ) || [];

      if (friendIds.length === 0) return [];

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      // Get all friends' locations (both in alert and not in alert)
      let { data, error } = await supabase
        .from('user_locations')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .in('user_id', friendIds)
        .gte('updated_at', thirtyMinutesAgo)
        .order('is_alert', { ascending: false });

      if (error) {
        console.log('⚠️ Failed to get friends locations:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to load friends locations:', error);
      return [];
    }
  }

  // Cleanup method to unsubscribe from realtime
  unsubscribeFromRealtimeChanges() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
  }

  // Check current status
  getStatus() {
    return {
      isActive: this.isActive,
      mode: this.isAlertMode ? 'ALERT' : 'BACKGROUND',
      lastLocation: this.lastKnownLocation,
      hasMovementTracking: !!this.locationSubscription,
      hasBackgroundInterval: !!this.backgroundInterval,
      hasRealtimeSubscription: !!this.realtimeSubscription
    };
  }

  // Manual location update (for testing)
  async forceLocationUpdate() {
    console.log('🔄 Manual location update requested');
    await this.sendLocationUpdate('immediate');
  }

  // DEPRECATED: Use getVisibleUserLocations instead
  async getAllUserLocations(): Promise<UserLocation[]> {
    console.warn('⚠️ getAllUserLocations is deprecated. Use getVisibleUserLocations instead.');
    return this.getVisibleUserLocations();
  }

  // DEPRECATED: Use subscribeToVisibleLocationChanges instead
  subscribeToLocationChanges(callback: (locations: UserLocation[]) => void) {
    console.warn('⚠️ subscribeToLocationChanges is deprecated. Use subscribeToVisibleLocationChanges instead.');
    return this.subscribeToVisibleLocationChanges(callback);
  }
}

// Create singleton instance
export const locationTracker = new LocationTracker();