import { Button } from "@react-navigation/elements";
import React, {
  useRef,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Stack, useRouter } from "expo-router";
import BSConfirmAlert from "../components/BSConfirmAlert";
import BSConfirmStop from "../components/BSConfirmStop";
import { Colors, Layout } from "../constants/Colors";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AntDesign, Fontisto, Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAuth } from "@/provider/AuthProvider";
import { Redirect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { locationTracker, UserLocation } from "@/lib/locationTracker";

export default function Index() {
  const router = useRouter();
  const { session } = useAuth();
  if (!session) {
    return <Redirect href="./(auth)/sign-in" />;
  }
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [onAlert, setOnAlert] = useState(false);
  const [BSConfirmAlertMounted, setBSConfirmAlertMounted] = useState(false);
  const [showStopSheet, setShowStopSheet] = useState(false);
  
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const stopSheetRef = useRef<BottomSheetModal>(null);
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<any>(null);
  const isInitialized = useRef(false);

  // Initialize location tracking when component mounts
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitialized.current) return;
    isInitialized.current = true;

    initializeLocationTracking();
    setupRealtimeSubscription();

    return () => {
      // Cleanup on unmount
      cleanup();
      isInitialized.current = false;
    };
  }, []);

  const initializeLocationTracking = async () => {
    try {
      console.log('🚀 Initializing location tracking...');
      
      // Get initial location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      console.log("Location:", loc);
      setLocation(loc);
      
      // Start location tracking in background mode
      await locationTracker.startTracking(false);
      
      // Load initial user locations
      await loadUserLocations();
      
      console.log('✅ Location tracking initialized');
    } catch (error) {
      console.error('❌ Failed to initialize location tracking:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à la localisation');
    }
  };

  const setupRealtimeSubscription = () => {
    // Subscribe to real-time location changes from other users
    locationSubscription.current = locationTracker.subscribeToLocationChanges(
      (locations) => {
        console.log(`📊 Received ${locations.length} user locations`);
        setUserLocations(locations);
        
        // Update current user's location from the data
        const currentUser = locations.find(loc => loc.user_id === session?.user?.id);
        if (currentUser) {
          setLocation({
            coords: {
              latitude: currentUser.latitude,
              longitude: currentUser.longitude,
              altitude: 0,
              accuracy: 0,
              heading: 0,
              speed: 0,
              altitudeAccuracy: 0,
            },
            timestamp: Date.now(),
          });
        }
      }
    );
  };

  const loadUserLocations = async () => {
    try {
      const locations = await locationTracker.getAllUserLocations();
      setUserLocations(locations);
      console.log(`📊 Loaded ${locations.length} user locations`);
    } catch (error) {
      console.error('❌ Failed to load user locations:', error);
    }
  };

  const cleanup = async () => {
    console.log('🧹 Cleaning up location tracking...');
    
    // Stop location tracking
    await locationTracker.stopTracking();
    
    // Unsubscribe from real-time updates
    if (locationSubscription.current) {
      locationSubscription.current.unsubscribe();
      locationSubscription.current = null;
    }
    
    // Also unsubscribe using the tracker's method
    locationTracker.unsubscribeFromRealtimeChanges();
  };

  const handlePresentModalPress = useCallback(() => {
    setBSConfirmAlertMounted(true);
    setTimeout(() => {
      bottomSheetModalRef.current?.present();
    }, 10);
  }, []);

  const handleCancelModalPress = useCallback(() => {
    setBSConfirmAlertMounted(false);
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const handleConfirmModalPress = useCallback(async () => {
    try {
      console.log('🚨 ACTIVATING ALERT MODE');
      console.log('📍 Now tracking every 5 meters of movement');
      
      // Switch to alert mode (5-meter movement tracking)
      await locationTracker.activateAlert();
      
      setOnAlert(true);
      setBSConfirmAlertMounted(false);
      bottomSheetModalRef.current?.dismiss();
      
      Alert.alert(
        "🚨 Mode Alerte Activé", 
        "Votre position est maintenant suivie précisément et partagée avec tous les utilisateurs"
      );
    } catch (error) {
      console.error('❌ Error activating alert mode:', error);
      Alert.alert("Erreur", "Impossible d'activer le mode alerte");
    }
  }, []);

  const handleStopAlert = useCallback(async () => {
    try {
      console.log('✅ DEACTIVATING ALERT MODE');
      console.log('📅 Returning to background mode');
      
      // Switch back to background mode
      await locationTracker.deactivateAlert();
      
      setOnAlert(false);
      setShowStopSheet(false);
      stopSheetRef.current?.dismiss();
      
      Alert.alert(
        "✅ Alerte Désactivée", 
        "Retour au mode arrière-plan"
      );
    } catch (error) {
      console.error('❌ Error deactivating alert mode:', error);
      Alert.alert("Erreur", "Impossible de désactiver l'alerte");
    }
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setBSConfirmAlertMounted(false);
    }
  }, []);

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    try {
      console.log('🔄 Manual refresh requested');
      await locationTracker.forceLocationUpdate();
      await loadUserLocations();
      Alert.alert("✅ Position mise à jour", "Votre position a été actualisée");
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      Alert.alert("Erreur", "Impossible de mettre à jour la position");
    }
  }, []);

  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [location]);

  const renderUserMarkers = () => {
    return userLocations.map((userLocation) => {
      // Don't show current user's marker
      if (userLocation.user_id === session?.user?.id) return null;

      const isAlert = userLocation.is_alert;
      // Updated to use profiles.full_name instead of profile.first_name + last_name
      const userName = userLocation.profiles?.full_name || 'Utilisateur';

      // Calculate time since last update
      const lastSeen = new Date(userLocation.updated_at);
      const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000);
      
      let timeDisplay;
      if (minutesAgo < 1) timeDisplay = 'à l\'instant';
      else if (minutesAgo < 60) timeDisplay = `il y a ${minutesAgo}min`;
      else timeDisplay = `il y a ${Math.floor(minutesAgo / 60)}h`;

      return (
        <Marker
          key={userLocation.user_id}
          coordinate={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          }}
          title={isAlert ? `🚨 ${userName}` : userName}
          description={isAlert ? `EN ALERTE! (${timeDisplay})` : `En ligne (${timeDisplay})`}
          pinColor={isAlert ? "#FF0000" : "#FFA500"}
        />
      );
    });
  };

  const handleSignOut = async () => {
    await cleanup();
    supabase.auth.signOut();
  };

  // Get statistics for display
  const alertUsers = userLocations.filter(u => u.is_alert);
  const onlineUsers = userLocations.length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          header: () => {
            return (
              <View
                style={{
                  height: insets.top + 44,
                  paddingTop: insets.top,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: Layout.padding,
                }}
              >
                {onAlert === false ? (
                  <>
                    {/* header left: bell */}
                    <Pressable
                      onPress={() => router.navigate("/alerts")}
                      style={({ pressed }) => [
                        {
                          width: Layout.buttonWidth,
                          height: Layout.buttonHeight,
                          backgroundColor: Colors.orange,
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: Layout.radiusLarge,
                          opacity: pressed ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Fontisto
                        style={{
                          padding: Layout.paddingSmall,
                        }}
                        name="bell"
                        size={24}
                        color="white"
                      />
                      {alertUsers.length > 0 && (
                        <View style={styles.alertBadge}>
                          <Text style={styles.alertBadgeText}>{alertUsers.length}</Text>
                        </View>
                      )}
                    </Pressable>
                    {/* header right: user/settings */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          {
                            width: Layout.buttonWidth,
                            height: Layout.buttonHeight,
                            backgroundColor: Colors.orange,
                            justifyContent: "center",
                            alignItems: "center",
                            borderRadius: Layout.radiusLarge,
                            opacity: pressed ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Feather name="users" size={28} color="white" />
                        <View style={styles.userCountBadge}>
                          <Text style={styles.userCountText}>{onlineUsers}</Text>
                        </View>
                      </Pressable>
                      
                      {/* Manual refresh button */}
                      <Pressable
                        onPress={handleManualRefresh}
                        style={({ pressed }) => [
                          {
                            width: Layout.buttonWidth,
                            height: Layout.buttonHeight,
                            backgroundColor: Colors.orange,
                            justifyContent: "center",
                            alignItems: "center",
                            borderRadius: Layout.radiusLarge,
                            opacity: pressed ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Feather name="refresh-cw" size={24} color="white" />
                      </Pressable>
                      
                      <Pressable
                        style={({ pressed }) => [
                          {
                            width: Layout.buttonWidth,
                            height: Layout.buttonHeight,
                            backgroundColor: Colors.orange,
                            justifyContent: "center",
                            alignItems: "center",
                            borderRadius: Layout.radiusLarge,
                            opacity: pressed ? 0.5 : 1,
                          },
                        ]}
                        onPress={() => router.navigate("/setting")}
                      >
                        <AntDesign name="setting" size={28} color="white" />
                      </Pressable>
                    </View>
                  </>
                ) : (
                  // onAlert === true: show STOP button
                  <Pressable
                    style={({ pressed }) => [
                      {
                        width: Layout.buttonWidth * 1.5,
                        height: Layout.buttonHeight * 1.5,
                        backgroundColor: Colors.red,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 50,
                        opacity: pressed ? 0.5 : 1,
                        position: "absolute",
                        top: insets.top + 10,
                        right: 10,
                        shadowColor: Colors.red,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                      },
                    ]}
                    onPress={() => {
                      setShowStopSheet(true);
                      setTimeout(() => {
                        stopSheetRef.current?.present();
                      }, 10);
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: Layout.fontWeightBold,
                      }}
                    >
                      STOP
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          },
        }}
      />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={true}
        showsScale={false}
        showsUserLocation={true}
        initialRegion={{
          latitude: location?.coords.latitude || 48.8566,
          longitude: location?.coords.longitude || 2.3522,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        onRegionChangeComplete={(region) => {
          console.log("Region changed:", region);
        }}
        onUserLocationChange={(e) => {
          console.log("User location changed:", e.nativeEvent.coordinate);
        }}
        onMapReady={() => {
          console.log("Map is ready");
        }}
      >
        {renderUserMarkers()}
      </MapView>

      {onAlert === false && (
        <TouchableOpacity
          style={styles.ovalButton}
          onPress={handlePresentModalPress}
        >
          <Text style={styles.buttonText}>SOS</Text>
        </TouchableOpacity>
      )}

      {/* Alert mode indicator */}
      {onAlert === true && (
        <View style={styles.alertModeIndicator}>
          <Text style={styles.alertModeText}>🚨 SUIVI PRÉCIS ACTIVÉ</Text>
          <Text style={styles.alertModeSubtext}>Tous les 5 mètres</Text>
        </View>
      )}

      {BSConfirmAlertMounted && (
        <BSConfirmAlert
          ref={bottomSheetModalRef}
          onConfirm={handleConfirmModalPress}
          onCancel={handleCancelModalPress}
          title={"Confirmation d'alerte"}
          message={"Nous allons alerter tous les utilisateurs autour de vous"}
          confirmLabel={"Confirmer"}
          cancelLabel={"Annuler"}
          confirmDelayMs={5000}
          onChange={handleSheetChanges}
        />
      )}
      {showStopSheet && (
        <BSConfirmStop
          ref={stopSheetRef}
          onConfirm={handleStopAlert}
          onCancel={() => {
            setShowStopSheet(false);
            stopSheetRef.current?.dismiss();
          }}
          title={"Arrêter l'alerte ?"}
          message={"Êtes-vous sûr de vouloir stopper l'alerte en cours ?"}
          confirmLabel={"Oui, arrêter"}
          cancelLabel={"Annuler"}
          onChange={(index) => {
            if (index === -1) setShowStopSheet(false);
          }}
        />
      )}
    </View>
  );
}

import type { ViewStyle, TextStyle } from "react-native";
import { navigate } from "expo-router/build/global-state/routing";

const styles = StyleSheet.create<{
  container: ViewStyle;
  map: ViewStyle;
  ovalButton: ViewStyle;
  buttonText: TextStyle;
  userCountBadge: ViewStyle;
  userCountText: TextStyle;
  alertBadge: ViewStyle;
  alertBadgeText: TextStyle;
  alertModeIndicator: ViewStyle;
  alertModeText: TextStyle;
  alertModeSubtext: TextStyle;
}>({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Layout.padding,
  },
  ovalButton: {
    backgroundColor: Colors.red,
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    width: "45%",
    paddingVertical: 18,
    borderRadius: Layout.radiusLarge,
    shadowColor: Colors.black,
    shadowOffset: Layout.shadowOffset,
    shadowOpacity: Layout.shadowOpacity,
    shadowRadius: Layout.shadowRadiusButton,
    elevation: 5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Layout.fontSizeBig,
    fontWeight: Layout.fontWeightBold,
    textAlign: "center",
  },
  userCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.red,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertModeIndicator: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: Colors.red,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Layout.radiusLarge,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alertModeText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  alertModeSubtext: {
    color: Colors.white,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.9,
  },
});