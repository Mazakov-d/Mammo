import React from "react";
import { Text, View, StyleSheet } from "react-native";
import MapView from "react-native-maps";

export default function Index() {
  return (
    <View style={styles.container}>
      <MapView
      style={styles.map}
      showsPointsOfInterest={true}        // Keep POIs visible
      showsBuildings={true}               // Show buildings
      showsTraffic={false}               // Hide traffic
      showsIndoors={true}                // Show indoor maps for malls/stations
      showsCompass={true}
      showsScale={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
