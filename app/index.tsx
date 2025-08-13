// app/index.tsx - Updated with friends system

import React, { useRef, useCallback, useState, useEffect, useMemo } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  Image,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Stack, useRouter } from "expo-router";
import BSConfirmAlert from "../components/BSConfirmAlert";
import BSConfirmStop from "../components/BSConfirmStop";
import { Colors, Layout } from "../constants/Colors";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AntDesign, Fontisto, Feather } from "@expo/vector-icons";
import { useAuthStore } from "@/store/useAuthStore";
import { Redirect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlertsStore } from "../store/useAlertsStore";
import { useLocationStore } from "../store/useUserLocationsStore";
import { locationTracker } from "@/lib/locationTracker";
import { emergencyOfflineManager } from "@/lib/emergencyOfflineManager";
import { useInitContacts } from "@/hooks/useInitContacts";
import { useMapContext } from "../contexts/MapContext";

export default function Index() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { targetLocation, clearTargetLocation } = useMapContext();

  if (!session) {
    return <Redirect href="./(auth)/sign-in" />;
  }
  const { alerts, fetchAlerts, subscribeAlerts } = useAlertsStore();
  const insets = useSafeAreaInsets();

  const {
    myLocation,
    userLocations,
    fetchVisibleLocations,
    subscribeToLocationChanges,
  } = useLocationStore();
  const onAlert = useMemo(() => !!profile?.alert_group_id, [profile?.alert_group_id]);
  const [BSConfirmAlertMounted, setBSConfirmAlertMounted] = useState(false);
  const [showStopSheet, setShowStopSheet] = useState(false);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const stopSheetRef = useRef<BottomSheetModal>(null);
  const mapRef = useRef<MapView>(null);

  useInitContacts();

  useEffect(() => {
    fetchVisibleLocations();
    locationTracker.startTracking();

    fetchAlerts();

    const alertsSubscription = subscribeAlerts();
    const locationsUnsubscribe = subscribeToLocationChanges();
    
    return () => {
      locationTracker.stopTracking();
      alertsSubscription?.unsubscribe();
      locationsUnsubscribe();
    };
  }, []);

  // onAlert derives from profile via useMemo above

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

  const createAlertDB = async () => {
    const { data: alertData, error: alertError } = await supabase
      .from("alerts")
      .insert([
        {
          creator_id: session!.user.id,
          status: "active",
        },
      ])
      .select();

    if (alertError) {
      console.error("Error creating alert:", alertError.message);
      return null;
    }

    const { error: profileError } = await useAuthStore.getState().updateProfile({
      alert_group_id: alertData ? alertData[0].id : null,
    });

    if (profileError) {
      console.error("Error creating alert:", profileError);
      return null;
    }

    console.log(alertData?.[0]);

    return alertData ? alertData[0] : null;
  };

  const archiveAlertDB = async () => {
    const currentAlertId = profile?.alert_group_id;
    if (!currentAlertId) return null;
    const { data, error: alertsError } = await supabase
      .from("alerts")
      .update({ status: "archived" })
      .eq("id", currentAlertId)
      .eq("status", "active")
      .select();

    if (alertsError) {
      console.error("Failed to update alert status:", alertsError.message);
      return null;
    }

    const { error: profileError } = await useAuthStore.getState().updateProfile({
      alert_group_id: null,
    });

    if (profileError) {
      console.error("Error creating alert:", profileError);
      return null;
    }

    await fetchAlerts();
    return data?.[0] || null;
  };

  const handleConfirmModalPress = useCallback(async () => {
    try {
      console.log("🚨 ACTIVATING ALERT MODE");
      setBSConfirmAlertMounted(false);
      bottomSheetModalRef.current?.dismiss();
      await createAlertDB();
      // Switch trackers: stop background tracking while in emergency
      locationTracker.stopTracking();
      // Start emergency high-accuracy/offline tracking
      emergencyOfflineManager.startEmergencyAlert();
      // Ensure alerts list reflects the new alert quickly
      fetchAlerts();
    } catch (error) {
      console.error("❌ Error activating alert mode:", error);
      Alert.alert("Erreur", "Impossible d'activer le mode alerte");
    }
  }, []);

  const handleStopAlert = useCallback(async () => {
    try {
      console.log("✅ DEACTIVATING ALERT MODE");
      console.log("📅 Returning to background mode");
      setShowStopSheet(false);
      stopSheetRef.current?.dismiss();
      await archiveAlertDB();
      // Stop emergency tracking
      emergencyOfflineManager.stopEmergencyAlert();
      // Resume background tracking
      locationTracker.startTracking();
    } catch (error) {
      console.error("❌ Error deactivating alert mode:", error);
      Alert.alert("Erreur", "Impossible de désactiver l'alerte");
    }
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setBSConfirmAlertMounted(false);
    }
  }, []);

  // Update the map region effect to use both myLocation and targetLocation
  useEffect(() => {
    if (mapRef.current) {
      if (targetLocation) {
        // If we have a target location, go there
        console.log('📍 Navigating to target location:', targetLocation);
        mapRef.current.animateToRegion({
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          latitudeDelta: 0.005, // Zoom in more when viewing specific location
          longitudeDelta: 0.005,
        });
      } else if (myLocation) {
        // Otherwise, use user's location
        mapRef.current.animateToRegion({
          latitude: myLocation.coords.latitude,
          longitude: myLocation.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    }
  }, [myLocation, targetLocation]);

  const renderUserMarkers = useCallback(() => {
    console.log(
      "🔍 renderUserMarkers called - userLocations:",
      userLocations.length
    );
    console.log(
      "📊 Valid coordinates:",
      userLocations.filter(
        (loc) =>
          loc.latitude &&
          loc.longitude &&
          !isNaN(loc.latitude) &&
          !isNaN(loc.longitude)
      ).length
    );

    const markers = userLocations
      .map((userLocation) => {
        console.log(
          "📍 Processing user:",
          userLocation.profiles?.full_name,
          "ID:",
          userLocation.user_id
        );
        console.log(
          "📍 Coords:",
          userLocation.latitude,
          userLocation.longitude
        );

        if (userLocation.user_id === session?.user?.id) {
          console.log("❌ Skipping own location");
          return null;
        }

        // Vérifier les coordonnées
        if (
          !userLocation.latitude ||
          !userLocation.longitude ||
          isNaN(userLocation.latitude) ||
          isNaN(userLocation.longitude)
        ) {
          console.log(
            "❌ Invalid coordinates for user:",
            userLocation.profiles?.full_name
          );
          return null;
        }

        let isAlert = false;
        alerts.forEach((alert) => {
          if (
            alert.creator_id === userLocation.user_id &&
            alert.status === "active"
          ) {
            isAlert = true;
          }
        });

        const userName = userLocation.profiles?.full_name || "Utilisateur";
        const lastSeen = new Date(userLocation.updated_at);
        const minutesAgo = Math.floor(
          (Date.now() - lastSeen.getTime()) / 60000
        );

        if (Math.floor(minutesAgo / 60) >= 24) {
          console.warn(
            `User ${userName} has not been seen for more than 24 hours, skipping marker`
          );
          return null;
        }

        let timeDisplay;
        if (minutesAgo < 1) timeDisplay = "à l'instant";
        else if (minutesAgo < 60) timeDisplay = `il y a ${minutesAgo}min`;
        else timeDisplay = `il y a ${Math.floor(minutesAgo / 60)}h`;

        console.log("✅ Returning user pin:", userName);
        return (
          <Marker
            key={userLocation.user_id}
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            title={isAlert ? `🚨 ${userName}` : userName}
            description={
              isAlert
                ? `EN ALERTE! (${timeDisplay})`
                : `En ligne (${timeDisplay})`
            }
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: Colors.orange,
                borderWidth: 3,
                borderColor: isAlert ? Colors.red : Colors.orange,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {userLocation.profiles?.avatar_url ? (
                <Image
                  source={{ uri: userLocation.profiles.avatar_url }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: isAlert ? Colors.red : Colors.white,
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </Marker>
        );
      })
      .filter((marker) => marker !== null);

    console.log("🎯 Final markers count:", markers.length);
    return markers;
  }, [userLocations, alerts, session?.user?.id]);

  // Add a banner to show when viewing someone's location
  const renderTargetLocationHeader = () => {
    if (!targetLocation) return null;
    
    return (
      <View style={styles.targetLocationBanner}>
        <Text style={styles.targetLocationText}>
          📍 Localisation de {targetLocation.userName || 'Utilisateur'}
        </Text>
        <Pressable 
          onPress={clearTargetLocation}
          style={styles.clearLocationButton}
        >
          <Text style={styles.clearLocationText}>Retour</Text>
        </Pressable>
      </View>
    );
  };

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
                  paddingHorizontal: 10,
                }}
              >
                {onAlert === false ? (
                  <>
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
                      {alerts.filter(
                        (alert) => alert.creator_id != session.user.id
                      ).length > 0 && (
                        <View style={styles.alertBadge}>
                          <Text style={styles.alertBadgeText}>
                            {
                              alerts.filter(
                                (alert) => alert.creator_id != session.user.id
                              ).length
                            }
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Pressable
                        onPress={() => router.navigate("/contacts")}
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
                        onPress={() => router.navigate("/settings")}
                      >
                        <AntDesign name="setting" size={28} color="white" />
                      </Pressable>
                    </View>
                  </>
                ) : (
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

      {renderTargetLocationHeader()}

      <MapView
        ref={mapRef}
        style={styles.map}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={true}
        showsScale={false}
        showsUserLocation={true}
        showsPointsOfInterest={false}
        initialRegion={{
          latitude: myLocation?.coords.latitude || 48.8566, // Use myLocation
          longitude: myLocation?.coords.longitude || 2.3522, // Use myLocation
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {userLocations.length > 0 && renderUserMarkers()}
        
        {/* Add a special marker for the target location */}
        {targetLocation && (
          <Marker
            coordinate={{
              latitude: targetLocation.latitude,
              longitude: targetLocation.longitude,
            }}
            title={`📍 ${targetLocation.userName || 'Utilisateur'}`}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: Colors.red,
                borderWidth: 4,
                borderColor: Colors.white,
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
                elevation: 8,
              }}
            >
              <AntDesign name="warning" size={24} color="white" />
            </View>
          </Marker>
        )}
      </MapView>

      {onAlert === false && (
        <TouchableOpacity
          style={styles.ovalButton}
          onPress={handlePresentModalPress}
        >
          <Text style={styles.buttonText}>SOS</Text>
        </TouchableOpacity>
      )}

      {BSConfirmAlertMounted && (
        <BSConfirmAlert
          ref={bottomSheetModalRef}
          onConfirm={handleConfirmModalPress}
          onCancel={handleCancelModalPress}
          title={"Confirmation d'alerte"}
          message={"Nous allons alerter tous vos amis"}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
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
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#2E7D32",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  userCountText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  alertBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: Colors.red,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  alertBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
  },
  targetLocationBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: Colors.orange,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  targetLocationText: {
    color: 'white',
    fontWeight: 'bold',
    flex: 1,
  },
  clearLocationButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearLocationText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});