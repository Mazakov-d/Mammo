import { Button } from "@react-navigation/elements";
import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import MapView from "react-native-maps";
import { Stack, useRouter } from "expo-router";
import BSConfirmAlert from "../components/BSConfirmAlert";
import BSConfirmStop from "../components/BSConfirmStop";
import { Colors, Layout } from "../constants/Colors";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { AntDesign, Fontisto, Feather } from "@expo/vector-icons";
import * as Location from "expo-location";

export default function Index() {
  const router = useRouter();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useMemo(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      console.log("Location:", loc);
      setLocation(loc);
    })();
  }, []);

  const [onAlert, setOnAlert] = useState(false);
  const [BSConfirmAlertMounted, setBSConfirmAlertMounted] = useState(false);
  const [showStopSheet, setShowStopSheet] = useState(false);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const stopSheetRef = useRef<BottomSheetModal>(null);
  const mapRef = useRef<MapView>(null);

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

  const handleConfirmModalPress = useCallback(() => {
    setOnAlert(true);
    setBSConfirmAlertMounted(false);
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setBSConfirmAlertMounted(false);
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerLeft: () => {
            return onAlert === false ? (
              <Pressable
                style={({ pressed }) => [
                  {
                    width: Layout.buttonWidth,
                    height: Layout.buttonHeight,
                    backgroundColor: Colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: Layout.radiusLarge,
                    opacity: pressed ? 0.5 : 1,
                  },
                ]}
              >
                <Fontisto
                  style={{
                    // backgroundColor:"red",
                    padding: Layout.paddingSmall,
                  }}
                  name="bell"
                  size={24}
                  color="white"
                />
              </Pressable>
            ) : null;
          },
          headerRight: () => {
            return onAlert === false ? (
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
                      backgroundColor: Colors.primary,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: Layout.radiusLarge,
                      opacity: pressed ? 0.5 : 1,
                    },
                  ]}
                >
                  <Feather name="user" size={28} color="white" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    {
                      width: Layout.buttonWidth,
                      height: Layout.buttonHeight,
                      backgroundColor: Colors.primary,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: Layout.radiusLarge,
                      opacity: pressed ? 0.5 : 1,
                    },
                  ]}
                >
                  <AntDesign name="setting" size={28} color="white" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  {
                    width: Layout.buttonWidth * 1.5,
                    height: Layout.buttonHeight * 1.5,
                    backgroundColor: Colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 50,
                    opacity: pressed ? 0.5 : 1,
                    position: "absolute",
                    top: 10,
                    right: 10,
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
                    fontSize: Layout.fontSizeSmall,
                    fontWeight: Layout.fontWeightBold,
                  }}
                >
                  STOP
                </Text>
              </Pressable>
            );
          },
          headerTitle: "",
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
      />

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
          onConfirm={() => {
            setOnAlert(false);
            setShowStopSheet(false);
            stopSheetRef.current?.dismiss();
          }}
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

const styles = StyleSheet.create<{
  container: ViewStyle;
  map: ViewStyle;
  ovalButton: ViewStyle;
  buttonText: TextStyle;
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
    backgroundColor: Colors.danger,
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    width: "45%",
    // paddingHorizontal: 60,
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
});
