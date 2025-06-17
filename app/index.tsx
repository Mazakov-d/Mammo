import { Button } from "@react-navigation/elements";
import React, { useRef, useMemo, useCallback, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import MapView from "react-native-maps";
import { useRouter } from "expo-router";
import BSConfirmAlert from "../components/BSConfirmAlert";
import { Colors, Layout } from "../constants/Colors";

export default function Index() {
  const router = useRouter();

  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const bottomSheetModalRef = useRef<typeof BSConfirmAlert>(null);

  const handlePresentModalPress = useCallback(() => {
    setShowConfirmAlert(true);
    setTimeout(() => {
      bottomSheetModalRef.current?.present();
    }, 10);
  }, []);

  const handleDismissModalPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      setShowConfirmAlert(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={false}
        showsScale={false}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.ovalButton}
          onPress={handlePresentModalPress}
        >
          <Text style={styles.buttonText}>SOS</Text>
        </TouchableOpacity>
      </View>

      {showConfirmAlert && (
        <BSConfirmAlert
          ref={bottomSheetModalRef}
          onConfirm={handleDismissModalPress}
          onCancel={handleDismissModalPress}
          title={"Confirmation d'alerte"}
          message={"Nous allons alerter tous les utilisateurs autour de vous"}
          confirmLabel={"Confirmer"}
          cancelLabel={"Annuler"}
          confirmDelayMs={5000}
          onChange={handleSheetChanges}
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
    paddingHorizontal: 60,
    paddingVertical: 20,
    borderRadius: Layout.radiusLarge,
    elevation: Layout.elevationButton,
    shadowColor: Colors.black,
    shadowOffset: Layout.shadowOffset,
    shadowOpacity: Layout.shadowOpacity,
    shadowRadius: Layout.shadowRadiusButton,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Layout.fontSizeBig,
    fontWeight: Layout.fontWeightBold,
    textAlign: "center",
  },
});
