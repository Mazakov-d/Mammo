// app/index.tsx - Updated with friends system

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
import { useAuth } from "@/provider/AuthProvider";
import { Redirect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlertsStore } from "../store/useAlertsStore";
import { useLocationStore } from "../store/useUserLocationsStore";
import { UserLocation } from "@/types/UserLocation";
import { locationTracker } from "@/lib/locationTracker";
import type { UserLocationChangeEvent } from "react-native-maps";

export default function Index() {
  const router = useRouter();
  const { session } = useAuth();
  if (!session) {
    return <Redirect href="./(auth)/sign-in" />;
  }
  const { alerts, isLoading, error, fetchAlerts, subscribeAlerts } =
    useAlertsStore();
  const insets = useSafeAreaInsets();

  const { myLocation, userLocations, fetchVisibleLocations } =
    useLocationStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [onAlert, setOnAlert] = useState(false);
  const [BSConfirmAlertMounted, setBSConfirmAlertMounted] = useState(false);
  const [showStopSheet, setShowStopSheet] = useState(false);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const stopSheetRef = useRef<BottomSheetModal>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchVisibleLocations();
    locationTracker.startTracking();

    fetchAlerts();

    const subscription = subscribeAlerts();

    return () => {
      locationTracker.stopTracking();

      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !alerts) return;
    setOnAlert(
      alerts.some(
        (alert) =>
          alert.creator_id === session.user.id && alert.status === "active"
      )
    );
  }, [alerts, session.user.id]);

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
    const { data, error } = await supabase.from("alerts").insert([
      {
        creator_id: session.user.id,
      },
    ]);

    if (error) {
      console.error("Error creating alert:", error.message);
      return null;
    }

    return data ? data[0] : null;
  };

  const archiveAlertDB = async () => {
    const { data, error } = await supabase
      .from("alerts")
      .update({ status: "archived" })
      .eq("creator_id", session.user.id)
      .select(); // optional: to get the updated row

    if (error) {
      console.error("Failed to update alert status:", error.message);
      return null;
    }

    return data[0]; // updated row
  };

  const handleConfirmModalPress = useCallback(async () => {
    try {
      console.log("🚨 ACTIVATING ALERT MODE");

      setOnAlert(true);
      setBSConfirmAlertMounted(false);
      bottomSheetModalRef.current?.dismiss();
      createAlertDB();
    } catch (error) {
      console.error("❌ Error activating alert mode:", error);
      Alert.alert("Erreur", "Impossible d'activer le mode alerte");
    }
  }, []);

  const handleStopAlert = useCallback(async () => {
    try {
      console.log("✅ DEACTIVATING ALERT MODE");
      console.log("📅 Returning to background mode");

      setOnAlert(false);
      setShowStopSheet(false);
      stopSheetRef.current?.dismiss();
      archiveAlertDB();
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

  useEffect(() => {
    if (myLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: myLocation.coords.latitude, // Direct access to latitude
        longitude: myLocation.coords.longitude, // Direct access to longitude
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [myLocation]);

  const renderUserMarkers = useCallback(() => {
    return userLocations.map((userLocation) => {
      console.log("Rendering user location:", JSON.stringify(userLocation));
      if (userLocation.user_id === session?.user?.id) return null;

      let isAlert = false;
      alerts.forEach((alert) => {
        console.log("alert", JSON.stringify(alert));
        console.log(
          `Checking alert for user: ${alert.creator_id}, status: ${alert.status}`
        );
        if (
          alert.creator_id === userLocation.user_id &&
          alert.status === "active"
        ) {
          isAlert = true;
        }
      });
      const userName = userLocation.profiles?.full_name || "Utilisateur";

      const lastSeen = new Date(userLocation.updated_at);
      const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000);

      let timeDisplay;
      if (minutesAgo < 1) timeDisplay = "à l'instant";
      else if (minutesAgo < 60) timeDisplay = `il y a ${minutesAgo}min`;
      else timeDisplay = `il y a ${Math.floor(minutesAgo / 60)}h`;

      return (
        <Marker
          key={userLocation.user_id}
          coordinate={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          }}
		  pinColor="blue"
        />
      );
    });
  }, [userLocations, alerts]);

  const handleSignOut = async () => {
    supabase.auth.signOut();
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
                      {alerts.length > 0 && (
                        <View style={styles.alertBadge}>
                          <Text style={styles.alertBadgeText}>
                            {alerts.length}
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
});
