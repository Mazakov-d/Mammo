import React, { forwardRef, useEffect, useRef, useState } from "react";
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  Easing,
  Image,
} from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Colors } from "../constants/Colors";

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
        enablePanDownToClose={false}
        handleComponent={null}
        onChange={onChange}
        enableContentPanningGesture={false}
      >
        <BottomSheetView style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Image
              source={require("@/assets/images/mammo_sos.png")}
              style={{ width: 150, height: 150 }}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>

          <View style={styles.confirmButtonWrapper}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: Colors.darkRed },
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
              disabled={autoPressed}
            >
              <Animated.View
                style={[
                  styles.confirmButtonFill,
                  {
                    width: widthInterpolate,
                    backgroundColor: Colors.red,
                  },
                ]}
              />
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onCancel}
            activeOpacity={0.8}
          >
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
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  handleIndicator: {
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.white,
    borderRadius: 32,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  modalTitle: {
    color: Colors.grayDark,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    color: Colors.gray,
    fontSize: 17,
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
  },
  confirmButtonWrapper: {
    width: "100%",
    marginBottom: 24,
  },
  confirmButton: {
    width: "100%",
    backgroundColor: Colors.black,
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  confirmButtonFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    zIndex: 1,
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: 19,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 4,
    zIndex: 2,
  },
  closeButton: {
    width: "60%",
    backgroundColor: Colors.orange,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    alignSelf: "center",
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    marginTop: 0,
    marginBottom: 16,
  },
  closeButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
