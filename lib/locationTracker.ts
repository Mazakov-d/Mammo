// lib/locationTracker.ts - Fixed multiple location update sources

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

interface CallbackSubscription {
  id: string;
  callback: (locations: UserLocation[]) => void;
  createdAt: number;
}

// Location update coordination system
interface LocationUpdate {
  id: string;
  source: 'background' | 'movement' | 'immediate' | 'manual';
  location: LocationState;
  timestamp: number;
  priority: number;
}

class LocationTracker {
  private lastKnownLocation: LocationState | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundInterval: ReturnType<typeof setInterval> | null = null;
  private isAlertMode: boolean = false;
  private isActive: boolean = false;
  private realtimeSubscription: any = null;
  private realtimeCallbacks: Map<string, CallbackSubscription> = new Map();
  
  // Location update coordination
  private updateQueue: LocationUpdate[] = [];
  private isProcessingUpdate: boolean = false;
  private lastUpdateTime: number = 0;
  private lastUpdateSource: string = '';
  private updateProcessor: ReturnType<typeof setInterval> | null = null;
  
  // Memory management
  private readonly MAX_CALLBACKS = 50;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CALLBACK_CLEANUP_INTERVAL = 5 * 60 * 1000;
  private readonly CALLBACK_MAX_AGE = 30 * 60 * 1000;

  // Update coordination config
  private readonly UPDATE_CONFIG = {
    MIN_UPDATE_INTERVAL: 2000,      // Minimum 2 seconds between updates
    PRIORITY_IMMEDIATE: 1,          // Manual updates, emergency
    PRIORITY_MOVEMENT: 2,           // Movement-based updates in alert mode
    PRIORITY_BACKGROUND: 3,         // Time-based background updates
    PRIORITY_MANUAL: 4,            // Manual refresh requests
    MAX_QUEUE_SIZE: 10,            // Maximum queued updates
    PROCESSING_INTERVAL: 1000,     // Process queue every second
  };

  // Configuration
  private readonly CONFIG = {
    BACKGROUND_MODE: {
      timeInterval: 15 * 60 * 1000,
      accuracy: Location.Accuracy.Balanced,
      maxAge: 2 * 60 * 1000
    },
    ALERT_MODE: {
      distanceInterval: 5,
      accuracy: Location.Accuracy.High,
      maxAge: 10 * 1000
    }
  };

  constructor() {
    this.startCallbackCleanup();
    this.startUpdateProcessor();
  }

  private startUpdateProcessor() {
    if (this.updateProcessor) {
      clearInterval(this.updateProcessor);
    }

    this.updateProcessor = setInterval(() => {
      this.processUpdateQueue();
    }, this.UPDATE_CONFIG.PROCESSING_INTERVAL);
  }

  private async processUpdateQueue() {
    if (this.isProcessingUpdate || this.updateQueue.length === 0) {
      return;
    }

    // Check if enough time has passed since last update
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_CONFIG.MIN_UPDATE_INTERVAL) {
      console.log(`⏳ Throttling update - ${this.UPDATE_CONFIG.MIN_UPDATE_INTERVAL - (now - this.lastUpdateTime)}ms remaining`);
      return;
    }

    this.isProcessingUpdate = true;

    try {
      // Sort queue by priority (lower number = higher priority)
      this.updateQueue.sort((a, b) => a.priority - b.priority);
      
      // Get the highest priority update
      const update = this.updateQueue.shift();
      if (!update) {
        this.isProcessingUpdate = false;
        return;
      }

      console.log(`📍 Processing location update from ${update.source} (priority: ${update.priority}, queue: ${this.updateQueue.length})`);

      // Check if this update is significantly different from last known location
      if (this.shouldSkipUpdate(update)) {
        console.log(`⏭️ Skipping redundant update from ${update.source}`);
        this.isProcessingUpdate = false;
        return;
      }

      // Process the update
      await this.executeLocationUpdate(update);
      
      // Update tracking variables
      this.lastUpdateTime = now;
      this.lastUpdateSource = update.source;
      
      // Clear any redundant updates from queue
      this.cleanRedundantUpdates(update);

    } catch (error) {
      console.error('❌ Error processing location update:', error);
    } finally {
      this.isProcessingUpdate = false;
    }
  }

  private shouldSkipUpdate(update: LocationUpdate): boolean {
    if (!this.lastKnownLocation) {
      return false; // Always process first update
    }

    const lastLoc = this.lastKnownLocation;
    const newLoc = update.location;

    // Calculate distance difference
    const latDiff = Math.abs(lastLoc.latitude - newLoc.latitude);
    const lngDiff = Math.abs(lastLoc.longitude - newLoc.longitude);

    // Different thresholds based on mode and source
    let threshold = 0.0001; // ~10 meters

    if (update.source === 'background') {
      threshold = 0.001; // ~100 meters for background updates
    } else if (update.source === 'movement' && this.isAlertMode) {
      threshold = 0.00005; // ~5 meters for alert movement
    } else if (update.source === 'immediate' || update.source === 'manual') {
      threshold = 0; // Always process immediate/manual updates
    }

    const isRedundant = latDiff < threshold && lngDiff < threshold;
    
    if (isRedundant && update.source !== 'immediate' && update.source !== 'manual') {
      console.log(`📍 Update from ${update.source} is redundant (${(latDiff * 111320).toFixed(1)}m, ${(lngDiff * 111320).toFixed(1)}m)`);
      return true;
    }

    return false;
  }

  private cleanRedundantUpdates(processedUpdate: LocationUpdate) {
    const before = this.updateQueue.length;
    
    // Remove updates from same source or lower priority updates that are now redundant
    this.updateQueue = this.updateQueue.filter(update => {
      // Keep higher priority updates
      if (update.priority < processedUpdate.priority) {
        return true;
      }
      
      // Remove same source updates (newer one was just processed)
      if (update.source === processedUpdate.source) {
        console.log(`🗑️ Removing redundant ${update.source} update from queue`);
        return false;
      }
      
      // Keep different sources for now
      return true;
    });

    const removed = before - this.updateQueue.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} redundant updates from queue`);
    }
  }

  private async executeLocationUpdate(update: LocationUpdate) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No authenticated user for location update');
        return;
      }

      const { error } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          latitude: update.location.latitude,
          longitude: update.location.longitude,
          is_alert: this.isAlertMode,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Database update error:', error);
        throw error;
      }

      console.log(`✅ Location updated from ${update.source}:`, 
        update.location.latitude.toFixed(6), 
        update.location.longitude.toFixed(6),
        this.isAlertMode ? '🚨 ALERT' : '📱 Background'
      );

      // Update local state
      this.lastKnownLocation = update.location;
      
      // Trigger real-time notifications
      setTimeout(() => {
        this.notifyCallbacks();
      }, 500);
      
    } catch (error) {
      console.error('❌ Failed to execute location update:', error);
      throw error;
    }
  }

  private queueLocationUpdate(
    location: LocationState, 
    source: 'background' | 'movement' | 'immediate' | 'manual'
  ) {
    // Determine priority based on source
    let priority: number;
    switch (source) {
      case 'immediate':
        priority = this.UPDATE_CONFIG.PRIORITY_IMMEDIATE;
        break;
      case 'movement':
        priority = this.UPDATE_CONFIG.PRIORITY_MOVEMENT;
        break;
      case 'background':
        priority = this.UPDATE_CONFIG.PRIORITY_BACKGROUND;
        break;
      case 'manual':
        priority = this.UPDATE_CONFIG.PRIORITY_MANUAL;
        break;
      default:
        priority = this.UPDATE_CONFIG.PRIORITY_MANUAL;
    }

    const update: LocationUpdate = {
      id: `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      source,
      location,
      timestamp: Date.now(),
      priority
    };

    // Check queue size limit
    if (this.updateQueue.length >= this.UPDATE_CONFIG.MAX_QUEUE_SIZE) {
      // Remove lowest priority update
      this.updateQueue.sort((a, b) => b.priority - a.priority);
      const removed = this.updateQueue.pop();
      console.log(`🗑️ Queue full, removed ${removed?.source} update`);
    }

    // Add to queue
    this.updateQueue.push(update);
    console.log(`📥 Queued ${source} update (priority: ${priority}, queue: ${this.updateQueue.length})`);

    // For immediate updates, try to process right away
    if (source === 'immediate' || source === 'manual') {
      setTimeout(() => this.processUpdateQueue(), 100);
    }
  }

  private startCallbackCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleCallbacks();
    }, this.CALLBACK_CLEANUP_INTERVAL);
  }

  private cleanupStaleCallbacks() {
    const now = Date.now();
    let removedCount = 0;

    for (const [id, subscription] of this.realtimeCallbacks.entries()) {
      if (now - subscription.createdAt > this.CALLBACK_MAX_AGE) {
        this.realtimeCallbacks.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} stale callbacks`);
    }

    if (this.realtimeCallbacks.size === 0) {
      this.unsubscribeFromRealtimeChanges();
    }
  }

  async startTracking(isAlert: boolean = false) {
    if (this.isActive) {
      console.log('⚠️ Location tracking is already active');
      return;
    }

    this.isAlertMode = isAlert;
    this.isActive = true;

    console.log(`🚀 Starting coordinated tracking - ${isAlert ? 'ALERT' : 'BACKGROUND'} mode`);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        this.isActive = false;
        throw new Error('Location permission denied');
      }

      if (isAlert) {
        await this.startAlertTracking();
      } else {
        await this.startBackgroundTracking();
      }

      // Send immediate location update when starting
      await this.sendImmediateUpdate();
      
      if (this.realtimeCallbacks.size > 0) {
        this.setupRealtimeSubscription();
      }
    } catch (error) {
      this.isActive = false;
      throw error;
    }
  }

  async stopTracking() {
    if (!this.isActive) {
      console.log('⚠️ Location tracking is not active');
      return;
    }

    console.log('🛑 Stopping coordinated location tracking');
    this.isActive = false;

    // Stop movement tracking
    if (this.locationSubscription) {
      try {
        this.locationSubscription.remove();
      } catch (error) {
        console.warn('⚠️ Error removing location subscription:', error);
      }
      this.locationSubscription = null;
    }

    // Stop background interval
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    // Clear update queue
    this.updateQueue = [];
    this.isProcessingUpdate = false;

    console.log('📍 Location tracking stopped, coordination cleared');
  }

  private setupRealtimeSubscription() {
    if (this.realtimeSubscription) {
      console.log('📡 Real-time subscription already exists');
      return;
    }

    if (this.realtimeCallbacks.size === 0) {
      console.log('📡 No callbacks registered, skipping real-time subscription');
      return;
    }

    console.log('📡 Setting up real-time subscription');
    
    this.realtimeSubscription = supabase
      .channel('location_tracker_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations'
        },
        async (payload) => {
          console.log('📍 Real-time location change:', payload.eventType, (payload.new as { user_id?: string })?.user_id);
          await this.notifyCallbacks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        async (payload) => {
          console.log('👥 Real-time contacts change:', payload.eventType);
          await this.notifyCallbacks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        async (payload) => {
          console.log('👤 Real-time profile change:', payload.eventType);
          await this.notifyCallbacks();
        }
      )
      .subscribe((status) => {
        console.log(`📡 Real-time subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Real-time subscription error, will retry');
          setTimeout(() => {
            this.reconnectRealtime();
          }, 5000);
        } else if (status === 'CLOSED') {
          console.log('📡 Real-time subscription closed');
          this.realtimeSubscription = null;
        }
      });
  }

  private async notifyCallbacks() {
    if (this.realtimeCallbacks.size === 0) {
      return;
    }

    try {
      const locations = await this.getVisibleUserLocations();
      const now = Date.now();
      const callbacksToRemove: string[] = [];

      for (const [id, subscription] of this.realtimeCallbacks.entries()) {
        try {
          if (now - subscription.createdAt > this.CALLBACK_MAX_AGE) {
            callbacksToRemove.push(id);
            continue;
          }

          subscription.callback(locations);
        } catch (error) {
          console.error(`❌ Error in callback ${id}:`, error);
          callbacksToRemove.push(id);
        }
      }

      callbacksToRemove.forEach(id => {
        this.realtimeCallbacks.delete(id);
        console.log(`🧹 Removed invalid callback: ${id}`);
      });

      if (this.realtimeCallbacks.size === 0) {
        this.unsubscribeFromRealtimeChanges();
      }

    } catch (error) {
      console.error('❌ Error getting locations for real-time update:', error);
    }
  }

  private reconnectRealtime() {
    if (this.realtimeCallbacks.size === 0) {
      console.log('📡 No callbacks remain, skipping reconnection');
      return;
    }

    console.log('🔄 Reconnecting real-time subscription...');
    
    if (this.realtimeSubscription) {
      try {
        this.realtimeSubscription.unsubscribe();
      } catch (error) {
        console.warn('⚠️ Error unsubscribing during reconnect:', error);
      }
      this.realtimeSubscription = null;
    }
    
    this.setupRealtimeSubscription();
  }

  private async startBackgroundTracking() {
    console.log('📅 Starting background mode - coordinated updates every 15 minutes');
    
    // Clear any existing interval
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }

    this.backgroundInterval = setInterval(async () => {
      if (!this.isActive) {
        if (this.backgroundInterval) {
          clearInterval(this.backgroundInterval);
          this.backgroundInterval = null;
        }
        return;
      }

      try {
        console.log('⏰ Background update triggered');
        await this.sendLocationUpdate('background');
      } catch (error) {
        console.error('❌ Background update failed:', error);
      }
    }, this.CONFIG.BACKGROUND_MODE.timeInterval);
  }

  private async startAlertTracking() {
    console.log('🚨 Starting alert mode - coordinated movement tracking every 5 meters');

    if (this.locationSubscription) {
      try {
        this.locationSubscription.remove();
      } catch (error) {
        console.warn('⚠️ Error removing existing location subscription:', error);
      }
    }

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: this.CONFIG.ALERT_MODE.accuracy,
        timeInterval: 2000,
        distanceInterval: this.CONFIG.ALERT_MODE.distanceInterval,
      },
      async (location) => {
        if (!this.isActive || !this.isAlertMode) {
          console.log('📍 Ignoring location update - tracking inactive or mode changed');
          return;
        }

        console.log('📍 Movement detected in alert mode:', 
          location.coords.latitude.toFixed(6), 
          location.coords.longitude.toFixed(6)
        );
        await this.handleLocationUpdate(location, 'movement');
      }
    );
  }

  private async sendImmediateUpdate() {
    try {
      console.log('⚡ Sending immediate coordinated location update');
      await this.sendLocationUpdate('immediate');
    } catch (error) {
      console.error('❌ Immediate update failed:', error);
    }
  }

  private async sendLocationUpdate(source: 'background' | 'movement' | 'immediate' | 'manual') {
    try {
      const config = this.isAlertMode ? this.CONFIG.ALERT_MODE : this.CONFIG.BACKGROUND_MODE;
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: config.accuracy,
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

    // Queue the update instead of processing immediately
    this.queueLocationUpdate(newLocation, source as any);
  }

  async switchToAlertMode() {
    if (this.isAlertMode) {
      console.log('⚠️ Already in alert mode');
      return;
    }

    console.log('🚨 Switching to coordinated ALERT mode');
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

    console.log('📱 Switching to coordinated BACKGROUND mode');
    this.isAlertMode = false;

    // Stop movement tracking
    if (this.locationSubscription) {
      try {
        this.locationSubscription.remove();
      } catch (error) {
        console.warn('⚠️ Error removing location subscription during mode switch:', error);
      }
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

  async getVisibleUserLocations(): Promise<UserLocation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // Get current user's location for geographic filtering
      const currentLocation = await this.getCurrentUserLocation();

      // 1. Get ALL friends globally (no geographic filtering for friends)
      console.log('👥 Loading all friends globally...');
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('contact_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (contactsError) {
        console.error('❌ Failed to get contacts:', contactsError);
      }

      const friendIds = contacts?.map(contact => contact.contact_id) || [];
      friendIds.push(user.id);

      let friendLocations: UserLocation[] = [];
      
      if (friendIds.length > 0) {
        const { data, error: friendsError } = await supabase
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

        if (friendsError) {
          console.error('❌ Failed to get friend locations:', friendsError);
        } else {
          friendLocations = data || [];
          console.log(`👥 Found ${friendLocations.length} friends globally`);
        }
      }

      // 2. Get alert users with geographic filtering (10km radius)
      let alertUsers: UserLocation[] = [];
      
      if (currentLocation) {
        console.log(`🚨 Loading alert users within 10km`);

        const boundingBox = this.calculateBoundingBox(
          currentLocation.latitude,
          currentLocation.longitude,
          10
        );

        const { data: nearbyAlerts, error: alertError } = await supabase
          .from('user_locations')
          .select(`
            *,
            profiles (
              full_name,
              avatar_url
            )
          `)
          .eq('is_alert', true)
          .gte('updated_at', thirtyMinutesAgo)
          .gte('latitude', boundingBox.minLat)
          .lte('latitude', boundingBox.maxLat)
          .gte('longitude', boundingBox.minLng)
          .lte('longitude', boundingBox.maxLng);

        if (!alertError && nearbyAlerts) {
          alertUsers = nearbyAlerts.filter(userLocation => {
            const distance = this.calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              userLocation.latitude,
              userLocation.longitude
            );
            return distance <= 10;
          });

          console.log(`🚨 Found ${alertUsers.length} alert users within 10km`);
        }
      }

      // 3. Combine and deduplicate
      const allVisibleUsers = [...friendLocations, ...alertUsers];
      const uniqueUsers = allVisibleUsers.filter((user, index, self) =>
        index === self.findIndex((u) => u.user_id === user.user_id)
      );

      // 4. Sort by alert status and distance
      uniqueUsers.sort((a, b) => {
        if (a.is_alert && !b.is_alert) return -1;
        if (!a.is_alert && b.is_alert) return 1;

        if (currentLocation) {
          const distanceA = this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            a.latitude,
            a.longitude
          );
          const distanceB = this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            b.latitude,
            b.longitude
          );
          return distanceA - distanceB;
        }

        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      const alertCount = uniqueUsers.filter(u => u.is_alert).length;
      const friendCount = uniqueUsers.filter(u => !u.is_alert).length;

      console.log(`🌍 Final result: ${uniqueUsers.length} users total`);
      console.log(`   - ${alertCount} alerts (within 10km)`);
      console.log(`   - ${friendCount} friends (global)`);

      return uniqueUsers;
    } catch (error) {
      console.error('❌ Failed to load visible user locations:', error);
      return [];
    }
  }

  private async getCurrentUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: userLocation, error } = await supabase
        .from('user_locations')
        .select('latitude, longitude')
        .eq('user_id', user.id)
        .single();

      if (!error && userLocation) {
        return {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        maxAge: 5 * 60 * 1000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };

    } catch (error) {
      console.error('❌ Failed to get current location:', error);
      return null;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateBoundingBox(centerLat: number, centerLng: number, radiusKm: number) {
    const latDegreePerKm = 1 / 111.32;
    const lngDegreePerKm = 1 / (111.32 * Math.cos(this.toRadians(centerLat)));

    const latRadius = radiusKm * latDegreePerKm;
    const lngRadius = radiusKm * lngDegreePerKm;

    return {
      minLat: centerLat - latRadius,
      maxLat: centerLat + latRadius,
      minLng: centerLng - lngRadius,
      maxLng: centerLng + lngRadius
    };
  }

  subscribeToVisibleLocationChanges(callback: (locations: UserLocation[]) => void) {
    const callbackId = `callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.realtimeCallbacks.size >= this.MAX_CALLBACKS) {
      console.warn('⚠️ Maximum callback limit reached, removing oldest callback');
      const oldestId = this.realtimeCallbacks.keys().next().value;
      this.realtimeCallbacks.delete(oldestId);
    }

    this.realtimeCallbacks.set(callbackId, {
      id: callbackId,
      callback,
      createdAt: Date.now()
    });

    console.log(`📝 Registered callback ${callbackId} (total: ${this.realtimeCallbacks.size})`);
    
    this.setupRealtimeSubscription();
    
    this.getVisibleUserLocations().then(locations => {
      if (this.realtimeCallbacks.has(callbackId)) {
        try {
          callback(locations);
        } catch (error) {
          console.error(`❌ Error in initial callback ${callbackId}:`, error);
          this.realtimeCallbacks.delete(callbackId);
        }
      }
    }).catch(error => {
      console.error('❌ Failed to get initial locations:', error);
    });

    return {
      unsubscribe: () => {
        const wasRemoved = this.realtimeCallbacks.delete(callbackId);
        
        if (wasRemoved) {
          console.log(`🗑️ Unsubscribed callback ${callbackId} (remaining: ${this.realtimeCallbacks.size})`);
        } else {
          console.warn(`⚠️ Callback ${callbackId} was already removed`);
        }
        
        if (this.realtimeCallbacks.size === 0) {
          console.log('🧹 No callbacks remaining, cleaning up real-time subscription');
          this.unsubscribeFromRealtimeChanges();
        }
      }
    };
  }

  unsubscribeFromRealtimeChanges() {
    if (this.realtimeSubscription) {
      console.log('🧹 Unsubscribing from real-time changes');
      try {
        this.realtimeSubscription.unsubscribe();
      } catch (error) {
        console.warn('⚠️ Error during real-time unsubscribe:', error);
      }
      this.realtimeSubscription = null;
    }
    
    const callbackCount = this.realtimeCallbacks.size;
    this.realtimeCallbacks.clear();
    
    if (callbackCount > 0) {
      console.log(`🧹 Cleared ${callbackCount} callbacks`);
    }
  }

  async destroy() {
    console.log('💥 Destroying coordinated location tracker...');
    
    await this.stopTracking();
    this.unsubscribeFromRealtimeChanges();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.updateProcessor) {
      clearInterval(this.updateProcessor);
      this.updateProcessor = null;
    }
    
    // Clear update queue and state
    this.updateQueue = [];
    this.isProcessingUpdate = false;
    this.lastKnownLocation = null;
    this.isActive = false;
    this.isAlertMode = false;
    
    console.log('✅ Coordinated location tracker destroyed');
  }

  getStatus() {
    return {
      isActive: this.isActive,
      mode: this.isAlertMode ? 'ALERT' : 'BACKGROUND',
      lastLocation: this.lastKnownLocation,
      hasMovementTracking: !!this.locationSubscription,
      hasBackgroundInterval: !!this.backgroundInterval,
      hasRealtimeSubscription: !!this.realtimeSubscription,
      callbackCount: this.realtimeCallbacks.size,
      maxCallbacks: this.MAX_CALLBACKS,
      hasCleanupInterval: !!this.cleanupInterval,
      coordination: {
        queueSize: this.updateQueue.length,
        isProcessing: this.isProcessingUpdate,
        lastUpdateTime: this.lastUpdateTime,
        lastUpdateSource: this.lastUpdateSource,
        minUpdateInterval: this.UPDATE_CONFIG.MIN_UPDATE_INTERVAL,
        hasUpdateProcessor: !!this.updateProcessor
      },
      memoryInfo: {
        callbackIds: Array.from(this.realtimeCallbacks.keys()),
        oldestCallback: this.realtimeCallbacks.size > 0 ? 
          Math.min(...Array.from(this.realtimeCallbacks.values()).map(s => s.createdAt)) : null
      }
    };
  }

  async forceLocationUpdate() {
    console.log('🔄 Manual location update requested');
    await this.sendLocationUpdate('manual');
    
    // Force notification to all callbacks after processing
    setTimeout(() => {
      this.notifyCallbacks();
    }, 2000);
  }

  async refreshSubscribers() {
    console.log('🔄 Refreshing all subscribers...');
    await this.notifyCallbacks();
  }

  async getFriendsLocations(): Promise<UserLocation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('👥 Loading all friends globally (no distance limit)...');
      
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('contact_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (contactsError) throw contactsError;

      const friendIds = contacts?.map(contact => contact.contact_id) || [];
      if (friendIds.length === 0) return [];

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
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

      let results = data || [];

      const currentLocation = await this.getCurrentUserLocation();
      
      if (currentLocation) {
        results.sort((a, b) => {
          if (a.is_alert && !b.is_alert) return -1;
          if (!a.is_alert && b.is_alert) return 1;

          const distanceA = this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            a.latitude,
            a.longitude
          );
          const distanceB = this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            b.latitude,
            b.longitude
          );

          return distanceA - distanceB;
        });

        results.forEach(userLocation => {
          const distance = this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            userLocation.latitude,
            userLocation.longitude
          );
          
          const distanceStr = distance > 100 ? `${(distance / 1000).toFixed(1)}k km` : `${distance.toFixed(1)}km`;
          console.log(`👤 ${userLocation.profiles?.full_name || 'Friend'}: ${distanceStr} ${userLocation.is_alert ? '🚨' : '👥'}`);
        });
      } else {
        results.sort((a, b) => {
          if (a.is_alert && !b.is_alert) return -1;
          if (!a.is_alert && b.is_alert) return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        console.log(`👥 Found ${results.length} friends globally (sorted by update time)`);
      }

      console.log(`👥 Total friends found: ${results.length} (global search)`);
      return results;

    } catch (error) {
      console.error('❌ Failed to load friends locations:', error);
      return [];
    }
  }

  // Get coordination status for debugging
  getCoordinationStatus() {
    return {
      queueSize: this.updateQueue.length,
      isProcessing: this.isProcessingUpdate,
      lastUpdate: {
        time: this.lastUpdateTime,
        source: this.lastUpdateSource,
        timeSince: Date.now() - this.lastUpdateTime
      },
      config: {
        minInterval: this.UPDATE_CONFIG.MIN_UPDATE_INTERVAL,
        maxQueueSize: this.UPDATE_CONFIG.MAX_QUEUE_SIZE,
        processingInterval: this.UPDATE_CONFIG.PROCESSING_INTERVAL
      },
      queue: this.updateQueue.map(update => ({
        id: update.id,
        source: update.source,
        priority: update.priority,
        age: Date.now() - update.timestamp
      }))
    };
  }

  // Manual queue processing (for testing)
  async processQueueManually() {
    console.log('🔄 Manual queue processing requested');
    await this.processUpdateQueue();
  }

  // Clear update queue (emergency)
  clearUpdateQueue() {
    const cleared = this.updateQueue.length;
    this.updateQueue = [];
    console.log(`🗑️ Cleared ${cleared} updates from queue`);
  }
}

// Create singleton instance
export const locationTracker = new LocationTracker();