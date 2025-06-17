import React, { forwardRef, useEffect, useRef, useState } from "react";
import { Text, StyleSheet, TouchableOpacity, View, Animated, Easing } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { AntDesign } from "@expo/vector-icons";

interface BSConfirmAlertProps {
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDelayMs?: number;
  onChange?: (index: number) => void;
}

const BSConfirmAlert = forwardRef<BottomSheetModal, BSConfirmAlertProps>(
  (
    {
      title = "Confirmation d'alerte",
      message = "Nous allons alerter tous les utilisateurs autour de vous",
      onConfirm,
      onCancel,
      confirmLabel = "Confirmer",
      cancelLabel = "Annuler",
      confirmDelayMs = 5000,
      onChange,
    },
    ref
  ) => {
    const [timer, setTimer] = useState(0);
    const [autoPressed, setAutoPressed] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      setTimer(0);
      setAutoPressed(false);
      progress.setValue(0);
      const interval = setInterval(() => {
        setTimer((t) => t + 100);
      }, 100);
      Animated.timing(progress, {
        toValue: 1,
        duration: confirmDelayMs,
        useNativeDriver: false,
        easing: Easing.linear,
      }).start();
      return () => {
        clearInterval(interval);
        progress.stopAnimation();
      };
    }, [confirmDelayMs]);

    useEffect(() => {
      if (timer >= confirmDelayMs && !autoPressed) {
        setAutoPressed(true);
        onConfirm();
      }
    }, [timer, confirmDelayMs, autoPressed, onConfirm]);

    const widthInterpolate = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        enablePanDownToClose={true}
        onChange={onChange}
      >
        <BottomSheetView style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <AntDesign name="warning" size={48} color="#da2d2d" />
          </View>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>

          <View style={styles.confirmButtonWrapper}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={autoPressed}
            >
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              <View style={styles.progressBarContainer}>
                <Animated.View style={[styles.progressBar, { width: widthInterpolate }]} />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.closeButtonText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

export default BSConfirmAlert;

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: "#191919",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  handleIndicator: {
    backgroundColor: "#444",
    width: 60,
    height: 6,
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 10,
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 32,
    paddingHorizontal: 24,
    minHeight: 340,
  },
  iconContainer: {
    marginBottom: 12,
    backgroundColor: "#fff2f2",
    borderRadius: 32,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#da2d2d",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    color: "#e0e0e0",
    fontSize: 17,
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
  },
  confirmButtonWrapper: {
    width: "100%",
    marginBottom: 18,
  },
  confirmButton: {
    width: "100%",
    backgroundColor: "#da2d2d",
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    shadowColor: "#da2d2d",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 19,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  progressBarContainer: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 6,
    width: "100%",
    backgroundColor: "#b71c1c",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: "hidden",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  closeButton: {
    width: "60%",
    backgroundColor: "#f88f39",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    alignSelf: "center",
    shadowColor: "#f88f39",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    marginTop: 0,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
}); 