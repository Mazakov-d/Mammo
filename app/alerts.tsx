import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, Pressable, FlatList, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { AntDesign, Feather } from "@expo/vector-icons";
import { Alert } from "@/types/Alert";
import { useAlertsStore } from "@/store/useAlertsStore";

export default function AlertsScreen() {
  const router = useRouter();
  const { alerts } = useAlertsStore();

  const calculateTimeAgo = (timestamp: string) => {
    const lastSeen = new Date(timestamp);
    const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000);
    
    if (minutesAgo < 1) return 'à l\'instant';
    else if (minutesAgo < 60) return `il y a ${minutesAgo} min`;
    else return `il y a ${Math.floor(minutesAgo / 60)}h`;
  };

  const renderAlertItem = ({ item }: { item: Alert}) => {
    const userName = item.profiles?.full_name || 'Utilisateur';
    const timeAgo = calculateTimeAgo(item.created_at);
    
    return (
      <View style={styles.alertItem}>
        <View style={styles.alertIcon}>
          <AntDesign name="warning" size={24} color={Colors.red} />
        </View>
        <View style={styles.alertInfo}>
          <Text style={styles.alertName}>{userName}</Text>
          <View style={styles.alertDetails}>
            <Feather name="map-pin" size={14} color="#666" />
            <Text style={styles.alertTime}>En alerte • {timeAgo}</Text>
          </View>
        </View>
        <Pressable
          style={styles.viewMapButton}
          onPress={() => router.back()}
        >
          <Text style={styles.viewMapText}>Voir sur la carte</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Alertes",
          headerTitleAlign: "center",
          headerTransparent: true,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                {
                  marginLeft: 10,
                  opacity: pressed ? 0.5 : 1,
                },
              ]}
            >
              <AntDesign name="arrowleft" size={28} color={Colors.orange} />
            </Pressable>
          ),
        }}
      />

      {alerts.length === 0 ? (
        <View style={styles.noAlertsContainer}>
          <Image
            source={require("@/assets/images/mammo_no_alert.png")}
            style={styles.noAlertsImage}
            resizeMode="contain"
          />
          <Text style={styles.noAlertsText}>
            Merci de vous inquiéter, mais tout va bien !
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.alertsList}
          contentContainerStyle={styles.alertsListContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.alertsTitle}>
            {alerts.length} {alerts.length > 1 ? 'alertes actives' : 'alerte active'}
          </Text>
          {alerts.map((user) => (
            <View key={user.id}>
              {renderAlertItem({ item: user })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.orange,
    fontSize: 16,
  },
  noAlertsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAlertsImage: {
    width: 180,
    height: 180,
    marginBottom: 30,
  },
  noAlertsText: {
    color: Colors.orange,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  alertsList: {
    flex: 1,
    marginTop: 100,
  },
  alertsListContent: {
    paddingBottom: 30,
  },
  alertsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 20,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE0E0',
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFEBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  alertDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertTime: {
    fontSize: 14,
    color: '#666',
  },
  viewMapButton: {
    backgroundColor: Colors.red,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewMapText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});