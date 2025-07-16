// lib/emergencyOfflineManager.ts - Emergency-focused offline system

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

interface EmergencyLocation {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  isAlert: boolean;
  source: 'gps' | 'network' | 'passive';
}

interface OfflineNotification {
  id: string;
  userId: string;
  userName: string;
  type: 'alert_started' | 'alert_stopped' | 'location_update';
  location: EmergencyLocation;
  timestamp: number;
  sent: boolean;
  retryCount: number;
}

interface EmergencyState {
  isOnline: boolean;
  isInEmergency: boolean;
  locationTracking: boolean;
  lastOnlineTime: number;
  emergencyStartTime: number | null;
  offlineLocations: EmergencyLocation[];
  pendingNotifications: OfflineNotification[];
  lastSuccessfulSync: number;
  batteryOptimization: boolean;
}

class EmergencyOfflineManager {
  private state: EmergencyState = {
    isOnline: true,
    isInEmergency: false,
    locationTracking: false,
    lastOnlineTime: Date.now(),
    emergencyStartTime: null,
    offlineLocations: [],
    pendingNotifications: [],
    lastSuccessfulSync: Date.now(),
    batteryOptimization: false,
  };

  private locationWatcher: Location.LocationSubscription | null = null;
  private emergencyInterval: ReturnType<typeof setInterval> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private statusCallbacks: Set<(state: EmergencyState) => void> = new Set();

  // Emergency configuration
  private readonly EMERGENCY_CONFIG = {
    LOCATION_INTERVAL: 10000,        // Check location every 10 seconds in emergency
    MIN_DISTANCE: 5,                 // Track every 5 meters movement
    HIGH_ACCURACY: true,             // Use GPS for maximum accuracy
    BATTERY_OPTIMIZATION: false,     // Disable battery optimization during emergency
    MAX_OFFLINE_LOCATIONS: 1000,     // Store up to 1000 offline locations
    NOTIFICATION_RETRY_LIMIT: 10,    // Retry notifications up to 10 times
    SYNC_RETRY_INTERVAL: 15000,      // Try to sync every 15 seconds when offline
    CACHE_DURATION: 24 * 60 * 60 * 1000, // Keep emergency data for 24 hours
  };

  private readonly STORAGE_KEYS = {
    EMERGENCY_STATE: 'emergency_offline_state',
    OFFLINE_LOCATIONS: 'emergency_offline_locations',
    PENDING_NOTIFICATIONS: 'emergency_pending_notifications',
    EMERGENCY_CONTACTS: 'emergency_contacts_cache',
    LAST_SYNC: 'emergency_last_sync',
  };

  constructor() {
    this.initialize();
  }

  async initialize() {
    console.log('🚨 Initializing Emergency Offline Manager...');
    
    // Setup notifications
    await this.setupNotifications();
    
    // Load persisted state
    await this.loadPersistedState();
    
    // Setup network monitoring
    this.setupNetworkMonitoring();
    
    // Setup periodic sync
    this.setupSyncInterval();
    
    console.log('✅ Emergency Offline Manager initialized');
  }

  private async setupNotifications() {
    // Configure notifications for emergency alerts
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true, // For emergency notifications
      },
    });

    if (status !== 'granted') {
      console.warn('⚠️ Notification permissions not granted');
    }
  }

  private async loadPersistedState() {
    try {
      // Load emergency state
      const stateStr = await AsyncStorage.getItem(this.STORAGE_KEYS.EMERGENCY_STATE);
      if (stateStr) {
        const persistedState = JSON.parse(stateStr);
        this.state = { ...this.state, ...persistedState };
      }

      // Load offline locations
      const locationsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_LOCATIONS);
      if (locationsStr) {
        this.state.offlineLocations = JSON.parse(locationsStr);
        console.log(`📍 Loaded ${this.state.offlineLocations.length} offline emergency locations`);
      }

      // Load pending notifications
      const notificationsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.PENDING_NOTIFICATIONS);
      if (notificationsStr) {
        this.state.pendingNotifications = JSON.parse(notificationsStr);
        console.log(`📲 Loaded ${this.state.pendingNotifications.length} pending notifications`);
      }

      // Resume emergency tracking if it was active
      if (this.state.isInEmergency) {
        console.log('🚨 Resuming emergency tracking from offline state');
        await this.startEmergencyTracking();
      }

    } catch (error) {
      console.error('❌ Error loading persisted emergency state:', error);
    }
  }

  private setupNetworkMonitoring() {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOnline = this.state.isOnline;
      const isOnline = state.isConnected === true && state.isInternetReachable === true;
      
      if (wasOnline !== isOnline) {
        console.log(`🌐 Emergency mode network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        this.state.isOnline = isOnline;
        
        if (isOnline) {
          this.state.lastOnlineTime = Date.now();
          this.handleGoingOnline();
        } else {
          this.handleGoingOffline();
        }
        
        this.persistState();
        this.notifyStatusCallbacks();
      }
    });
  }

  private setupSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.state.isOnline) {
        this.syncOfflineData();
      }
    }, this.EMERGENCY_CONFIG.SYNC_RETRY_INTERVAL);
  }

  private async handleGoingOnline() {
    console.log('✅ Back online during emergency - syncing data...');
    
    // Immediately sync all offline data
    await this.syncOfflineData();
    
    // Send all pending notifications
    await this.sendPendingNotifications();
    
    // Continue emergency tracking if active
    if (this.state.isInEmergency && !this.locationWatcher) {
      await this.startEmergencyTracking();
    }
  }

  private async handleGoingOffline() {
    console.log('📱 Gone offline during emergency - enabling offline mode...');
    
    // Show offline notification
    await this.showOfflineNotification();
    
    // Ensure emergency tracking continues
    if (this.state.isInEmergency) {
      await this.startEmergencyTracking();
    }
  }

  // Emergency Alert Management
  async startEmergencyAlert(): Promise<void> {
    console.log('🚨 STARTING EMERGENCY ALERT - OFFLINE CAPABLE');
    
    this.state.isInEmergency = true;
    this.state.emergencyStartTime = Date.now();
    this.state.locationTracking = true;
    
    // Start aggressive location tracking
    await this.startEmergencyTracking();
    
    // Create emergency notification for friends
    await this.createEmergencyNotification('alert_started');
    
    // Show local notification
    await this.showLocalEmergencyNotification('Emergency alert activated - tracking your location');
    
    await this.persistState();
    this.notifyStatusCallbacks();
  }

  async stopEmergencyAlert(): Promise<void> {
    console.log('✅ STOPPING EMERGENCY ALERT');
    
    this.state.isInEmergency = false;
    this.state.emergencyStartTime = null;
    this.state.locationTracking = false;
    
    // Stop location tracking
    await this.stopEmergencyTracking();
    
    // Create stop notification for friends
    await this.createEmergencyNotification('alert_stopped');
    
    // Show local notification
    await this.showLocalEmergencyNotification('Emergency alert stopped');
    
    await this.persistState();
    this.notifyStatusCallbacks();
  }

  private async startEmergencyTracking() {
    console.log('📍 Starting emergency location tracking (offline capable)');
    
    // Stop any existing watcher
    if (this.locationWatcher) {
      this.locationWatcher.remove();
    }

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied during emergency');
      }

      // Start high-accuracy location tracking
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation, // Highest accuracy
          timeInterval: this.EMERGENCY_CONFIG.LOCATION_INTERVAL,
          distanceInterval: this.EMERGENCY_CONFIG.MIN_DISTANCE,
        },
        (location) => {
          this.handleEmergencyLocation(location);
        }
      );

      console.log('✅ Emergency location tracking started');

    } catch (error) {
      console.error('❌ Failed to start emergency tracking:', error);
      
      // Fallback: try with lower accuracy
      try {
        this.locationWatcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: this.EMERGENCY_CONFIG.LOCATION_INTERVAL * 2,
            distanceInterval: this.EMERGENCY_CONFIG.MIN_DISTANCE * 2,
          },
          (location) => {
            this.handleEmergencyLocation(location);
          }
        );
        console.log('⚠️ Emergency tracking started with reduced accuracy');
      } catch (fallbackError) {
        console.error('❌ Emergency tracking completely failed:', fallbackError);
      }
    }
  }

  private async stopEmergencyTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
      console.log('🛑 Emergency location tracking stopped');
    }
  }

  private async handleEmergencyLocation(location: Location.LocationObject) {
    const emergencyLocation: EmergencyLocation = {
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now(),
      accuracy: location.coords.accuracy || 0,
      isAlert: this.state.isInEmergency,
      source: location.coords.accuracy && location.coords.accuracy < 20 ? 'gps' : 'network',
    };

    console.log(`📍 Emergency location: ${emergencyLocation.latitude.toFixed(6)}, ${emergencyLocation.longitude.toFixed(6)} (±${emergencyLocation.accuracy}m)`);

    // Store location offline
    this.state.offlineLocations.push(emergencyLocation);

    // Limit offline storage
    if (this.state.offlineLocations.length > this.EMERGENCY_CONFIG.MAX_OFFLINE_LOCATIONS) {
      this.state.offlineLocations = this.state.offlineLocations.slice(-this.EMERGENCY_CONFIG.MAX_OFFLINE_LOCATIONS);
    }

    // Try to sync immediately if online
    if (this.state.isOnline) {
      try {
        await this.syncLocationToServer(emergencyLocation);
      } catch (error) {
        console.error('❌ Failed to sync emergency location:', error);
      }
    }

    // Create location update notification for friends
    await this.createEmergencyNotification('location_update', emergencyLocation);

    await this.persistState();
  }

  private async syncLocationToServer(location: EmergencyLocation): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { error } = await supabase
      .from('user_locations')
      .upsert({
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        is_alert: location.isAlert,
        updated_at: new Date(location.timestamp).toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    console.log('✅ Emergency location synced to server');
  }

  // Notification System
  private async createEmergencyNotification(
    type: OfflineNotification['type'],
    location?: EmergencyLocation
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile for name
    const profile = await this.getCachedProfile();
    const userName = profile?.full_name || 'Someone';

    const notification: OfflineNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: user.id,
      userName,
      type,
      location: location || this.state.offlineLocations[this.state.offlineLocations.length - 1],
      timestamp: Date.now(),
      sent: false,
      retryCount: 0,
    };

    this.state.pendingNotifications.push(notification);

    // Try to send immediately if online
    if (this.state.isOnline) {
      await this.sendNotificationToFriends(notification);
    }

    await this.persistState();
  }

  private async sendNotificationToFriends(notification: OfflineNotification): Promise<void> {
    try {
      // Get emergency contacts
      const contacts = await this.getEmergencyContacts();
      
      for (const contact of contacts) {
        await this.sendPushNotification(contact, notification);
      }

      notification.sent = true;
      console.log(`📲 Emergency notification sent to ${contacts.length} contacts`);

    } catch (error) {
      console.error('❌ Failed to send emergency notification:', error);
      notification.retryCount++;
      
      if (notification.retryCount >= this.EMERGENCY_CONFIG.NOTIFICATION_RETRY_LIMIT) {
        console.log('❌ Notification retry limit reached, marking as failed');
        notification.sent = true; // Mark as sent to stop retrying
      }
    }
  }

  private async sendPushNotification(contact: any, notification: OfflineNotification) {
    // This would integrate with your push notification service
    // For now, we'll simulate the notification
    
    let message = '';
    let priority = 'high';
    
    switch (notification.type) {
      case 'alert_started':
        message = `🚨 EMERGENCY: ${notification.userName} has activated an emergency alert and needs help!`;
        priority = 'max';
        break;
      case 'alert_stopped':
        message = `✅ ${notification.userName} has stopped their emergency alert`;
        priority = 'high';
        break;
      case 'location_update':
        message = `📍 Emergency update: ${notification.userName} is at a new location`;
        priority = 'high';
        break;
    }

    // In a real implementation, you'd send this to a push notification service
    console.log(`📲 Sending to ${contact.full_name}: ${message}`);
    
    // Simulate push notification API call
    const response = await fetch('https://your-push-service.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: contact.push_token,
        title: 'Emergency Alert',
        body: message,
        priority,
        data: {
          type: 'emergency',
          userId: notification.userId,
          location: notification.location,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Push notification failed: ${response.status}`);
    }
  }

  private async sendPendingNotifications(): Promise<void> {
    const pendingNotifications = this.state.pendingNotifications.filter(n => !n.sent);
    
    if (pendingNotifications.length === 0) return;

    console.log(`📲 Sending ${pendingNotifications.length} pending emergency notifications...`);

    for (const notification of pendingNotifications) {
      try {
        await this.sendNotificationToFriends(notification);
      } catch (error) {
        console.error(`❌ Failed to send notification ${notification.id}:`, error);
      }
    }

    await this.persistState();
  }

  // Data Sync
  private async syncOfflineData(): Promise<void> {
    if (!this.state.isOnline) return;

    console.log('🔄 Syncing offline emergency data...');

    try {
      // Sync offline locations
      await this.syncOfflineLocations();
      
      // Send pending notifications
      await this.sendPendingNotifications();
      
      this.state.lastSuccessfulSync = Date.now();
      console.log('✅ Emergency data sync completed');

    } catch (error) {
      console.error('❌ Emergency data sync failed:', error);
    }

    await this.persistState();
  }

  private async syncOfflineLocations(): Promise<void> {
    const unsyncedLocations = this.state.offlineLocations.filter(loc => !('synced' in loc));
    
    if (unsyncedLocations.length === 0) return;

    console.log(`📍 Syncing ${unsyncedLocations.length} offline emergency locations...`);

    for (const location of unsyncedLocations) {
      try {
        await this.syncLocationToServer(location);
        (location as any).synced = true;
      } catch (error) {
        console.error(`❌ Failed to sync location ${location.id}:`, error);
      }
    }
  }

  // Local Notifications
  private async showLocalEmergencyNotification(message: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Emergency Alert',
        body: message,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'emergency',
      },
      trigger: null, // Show immediately
    });
  }

  private async showOfflineNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Emergency Mode - Offline',
        body: 'Your emergency alert is still active. Location tracking continues offline.',
        sound: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  }

  // Cache Management
  private async getEmergencyContacts(): Promise<any[]> {
    try {
      // Try to get from cache first
      const cachedStr = await AsyncStorage.getItem(this.STORAGE_KEYS.EMERGENCY_CONTACTS);
      if (cachedStr) {
        return JSON.parse(cachedStr);
      }

      // If online, fetch and cache
      if (this.state.isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: contacts } = await supabase
          .from('contacts')
          .select(`
            contact_id,
            profiles!contacts_contact_id_fkey (
              full_name,
              push_token
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'accepted');

        const contactsData = contacts?.map(c => c.profiles).filter(Boolean) || [];
        
        // Cache for offline use
        await AsyncStorage.setItem(
          this.STORAGE_KEYS.EMERGENCY_CONTACTS,
          JSON.stringify(contactsData)
        );

        return contactsData;
      }

      return [];
    } catch (error) {
      console.error('❌ Error getting emergency contacts:', error);
      return [];
    }
  }

  private async getCachedProfile(): Promise<any | null> {
    try {
      const cachedStr = await AsyncStorage.getItem('cached_profile');
      return cachedStr ? JSON.parse(cachedStr) : null;
    } catch {
      return null;
    }
  }

  // State Management
  private async persistState() {
    try {
      await AsyncStorage.multiSet([
        [this.STORAGE_KEYS.EMERGENCY_STATE, JSON.stringify(this.state)],
        [this.STORAGE_KEYS.OFFLINE_LOCATIONS, JSON.stringify(this.state.offlineLocations)],
        [this.STORAGE_KEYS.PENDING_NOTIFICATIONS, JSON.stringify(this.state.pendingNotifications)],
        [this.STORAGE_KEYS.LAST_SYNC, this.state.lastSuccessfulSync.toString()],
      ]);
    } catch (error) {
      console.error('❌ Error persisting emergency state:', error);
    }
  }

  // Public API
  isInEmergency(): boolean {
    return this.state.isInEmergency;
  }

  isOnline(): boolean {
    return this.state.isOnline;
  }

  getEmergencyState(): EmergencyState {
    return { ...this.state };
  }

  getOfflineLocationsCount(): number {
    return this.state.offlineLocations.length;
  }

  getPendingNotificationsCount(): number {
    return this.state.pendingNotifications.filter(n => !n.sent).length;
  }

  getTimeSinceLastSync(): number {
    return Date.now() - this.state.lastSuccessfulSync;
  }

  // Status callbacks
  onStatusChange(callback: (state: EmergencyState) => void): () => void {
    this.statusCallbacks.add(callback);
    callback(this.state); // Send initial state
    
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  private notifyStatusCallbacks() {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('❌ Error in emergency status callback:', error);
      }
    });
  }

  // Cleanup
  async destroy(): Promise<void> {
    console.log('💥 Destroying Emergency Offline Manager...');
    
    await this.stopEmergencyTracking();
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    this.statusCallbacks.clear();
    
    console.log('✅ Emergency Offline Manager destroyed');
  }

  // Emergency utilities
  async forceSync(): Promise<void> {
    if (this.state.isOnline) {
      await this.syncOfflineData();
    }
  }

  async clearEmergencyData(): Promise<void> {
    this.state.offlineLocations = [];
    this.state.pendingNotifications = [];
    await this.persistState();
    console.log('🗑️ Emergency data cleared');
  }

  async exportEmergencyData(): Promise<string> {
    const exportData = {
      emergencyStartTime: this.state.emergencyStartTime,
      locations: this.state.offlineLocations,
      notifications: this.state.pendingNotifications,
      exportTime: Date.now(),
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Create singleton instance
export const emergencyOfflineManager = new EmergencyOfflineManager();