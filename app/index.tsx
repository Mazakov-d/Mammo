import { Button } from "@react-navigation/elements";
import React, { useRef, useMemo, useCallback, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import MapView from "react-native-maps";
import { useRouter } from "expo-router";
import BSConfirmAlert from "../components/BSConfirmAlert";

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
  bottomSheetBackground: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: "#666",
    width: 40,
    height: 4,
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
	justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 20,
    height: 400,

  },
  modalTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  modalText: {
    color: "white",
    fontSize: 18,
    marginBottom: 30,
  },


  confirmButton: {
    backgroundColor: "#da2d2d",
    paddingHorizontal: 80,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },

  closeButton: {
    backgroundColor: "#f88f39",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  ovalButton: {
    backgroundColor: "red",
    paddingHorizontal: 60,
    paddingVertical: 20,
    borderRadius: 25,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
  },
});
