// app/groups/index.tsx - Emergency Groups Page

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { AntDesign, Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";

interface EmergencyGroup {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'resolved' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  creator_id: string;
  member_count: number;
  unread_count: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  creator_profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

export default function GroupsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [groups, setGroups] = useState<EmergencyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGroups();
    
    // Subscribe to real-time updates
    const groupsSubscription = supabase
      .channel("emergency_groups_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergency_groups",
        },
        () => {
          loadGroups();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergency_group_messages",
        },
        () => {
          loadGroups();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergency_group_members",
        },
        () => {
          loadGroups();
        }
      )
      .subscribe();

    return () => {
      groupsSubscription.unsubscribe();
    };
  }, [session?.user?.id]);

  const loadGroups = async () => {
    try {
      if (!session?.user?.id) return;

      // Get groups where user is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from('emergency_group_members')
        .select(`
          group_id,
          emergency_groups!inner (
            id,
            title,
            description,
            status,
            priority,
            created_at,
            updated_at,
            creator_id,
            profiles!emergency_groups_creator_id_fkey (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'accepted')
        .eq('emergency_groups.status', 'active')
        .order('emergency_groups.updated_at', { ascending: false });

      if (memberError) throw memberError;

      // Process groups and add additional info
      const processedGroups = await Promise.all(
        (memberGroups || []).map(async (member: any) => {
          const group = member.emergency_groups;
          
          // Get member count
          const { count: memberCount } = await supabase
            .from('emergency_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('status', 'accepted');

          // Get last message
          const { data: lastMessage } = await supabase
            .from('emergency_group_messages')
            .select(`
              content,
              created_at,
              profiles!emergency_group_messages_sender_id_fkey (
                full_name
              )
            `)
            .eq('group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count (simplified - in production you'd use message_reads table)
          const { count: unreadCount } = await supabase
            .from('emergency_group_messages')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h as unread

          return {
            id: group.id,
            title: group.title,
            description: group.description,
            status: group.status,
            priority: group.priority,
            created_at: group.created_at,
            updated_at: group.updated_at,
            creator_id: group.creator_id,
            member_count: memberCount || 0,
            unread_count: Math.min(unreadCount || 0, 99), // Cap at 99
            last_message: lastMessage ? {
              content: lastMessage.content,
              sender_name: lastMessage.profiles?.full_name || 'Utilisateur',
              created_at: lastMessage.created_at,
            } : undefined,
            creator_profile: group.profiles,
          };
        })
      );

      setGroups(processedGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
      Alert.alert("Erreur", "Impossible de charger les groupes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF6B00';
      case 'medium': return '#FFA500';
      case 'low': return '#32CD32';
      default: return Colors.orange;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return 'warning';
      case 'high': return 'exclamation';
      case 'medium': return 'info';
      case 'low': return 'check';
      default: return 'info';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes}min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}j`;
  };

  const renderGroupItem = ({ item }: { item: EmergencyGroup }) => {
    const priorityColor = getPriorityColor(item.priority);
    
    return (
      <TouchableOpacity
        style={[styles.groupItem, { borderLeftColor: priorityColor }]}
        onPress={() => router.push(`/groups/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.groupHeader}>
          <View style={styles.groupInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.groupTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
                <AntDesign name={getPriorityIcon(item.priority) as any} size={12} color="white" />
              </View>
            </View>
            
            <View style={styles.groupMeta}>
              <View style={styles.memberCount}>
                <Feather name="users" size={14} color="#666" />
                <Text style={styles.memberCountText}>{item.member_count}</Text>
              </View>
              
              <Text style={styles.timeAgo}>
                {formatTimeAgo(item.updated_at)}
              </Text>
            </View>
          </View>
          
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>

        {item.last_message && (
          <View style={styles.lastMessage}>
            <Text style={styles.lastMessageSender} numberOfLines={1}>
              {item.last_message.sender_name}:
            </Text>
            <Text style={styles.lastMessageContent} numberOfLines={2}>
              {item.last_message.content}
            </Text>
          </View>
        )}

        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require("@/assets/images/mammo_face_sat_no_bg.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>Aucun groupe d'urgence</Text>
      <Text style={styles.emptySubtitle}>
        Les groupes d'urgence apparaîtront ici quand vous ou vos amis lancerez une alerte
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Groupes d'urgence",
          headerTitleAlign: "center",
          headerTransparent: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 10 }}
            >
              <AntDesign name="arrowleft" size={28} color={Colors.orange} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={onRefresh}
                style={styles.headerButton}
              >
                <AntDesign name="reload1" size={24} color={Colors.orange} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={styles.loadingText}>Chargement des groupes...</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            groups.length === 0 && { flex: 1 }
          ]}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.orange}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.orange,
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 10,
  },
  listContent: {
    paddingTop: 100,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  groupItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCountText: {
    fontSize: 14,
    color: "#666",
  },
  timeAgo: {
    fontSize: 12,
    color: "#999",
  },
  unreadBadge: {
    backgroundColor: Colors.red,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastMessage: {
    marginTop: 8,
  },
  lastMessageSender: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.orange,
    marginBottom: 2,
  },
  lastMessageContent: {
    fontSize: 14,
    color: "#666",
    lineHeight: 18,
  },
  groupDescription: {
    fontSize: 14,
    color: "#888",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});