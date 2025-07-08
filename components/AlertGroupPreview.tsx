// components/AlertGroupPreview.tsx - Shows emergency group preview during alerts

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/provider/AuthProvider';
import { useRouter } from 'expo-router';

interface GroupPreviewData {
  id: string;
  title: string;
  member_count: number;
  recent_messages: Array<{
    id: string;
    content: string;
    sender_name: string;
    created_at: string;
    is_urgent: boolean;
  }>;
}

interface AlertGroupPreviewProps {
  isVisible: boolean;
}

export default function AlertGroupPreview({ isVisible }: AlertGroupPreviewProps) {
  const { session } = useAuth();
  const router = useRouter();
  const [groupData, setGroupData] = useState<GroupPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isVisible && session?.user?.id) {
      loadActiveGroup();
      
      // Subscribe to real-time updates
      const subscription = supabase
        .channel('alert_group_preview')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emergency_group_messages',
          },
          () => {
            loadActiveGroup();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isVisible, session?.user?.id]);

  const loadActiveGroup = async () => {
    try {
      if (!session?.user?.id) return;

      // Find the most recent active group where user is creator or member
      const { data: userGroups, error: groupsError } = await supabase
        .from('emergency_group_members')
        .select(`
          group_id,
          emergency_groups!inner (
            id,
            title,
            status,
            created_at,
            creator_id
          )
        `)
        .eq('user_id', session.user.id)
        .eq('status', 'accepted')
        .eq('emergency_groups.status', 'active')
        .order('emergency_groups.created_at', { ascending: false })
        .limit(1);

      if (groupsError) throw groupsError;

      if (!userGroups || userGroups.length === 0) {
        setGroupData(null);
        setLoading(false);
        return;
      }

      const group = userGroups[0].emergency_groups;

      // Get member count
      const { count: memberCount } = await supabase
        .from('emergency_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted');

      // Get recent messages
      const { data: messages, error: messagesError } = await supabase
        .from('emergency_group_messages')
        .select(`
          id,
          content,
          created_at,
          is_urgent,
          profiles!emergency_group_messages_sender_id_fkey (
            full_name
          )
        `)
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (messagesError) throw messagesError;

      const recentMessages = messages?.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_name: msg.profiles?.full_name || 'Utilisateur',
        created_at: msg.created_at,
        is_urgent: msg.is_urgent,
      })) || [];

      setGroupData({
        id: group.id,
        title: group.title,
        member_count: memberCount || 0,
        recent_messages: recentMessages,
      });

    } catch (error) {
      console.error('Failed to load active group:', error);
      setGroupData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes}min`;
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const openGroup = () => {
    if (groupData?.id) {
      router.push(`/groups/${groupData.id}`);
    }
  };

  if (!isVisible || loading) {
    return null;
  }

  if (!groupData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialIcons name="group" size={24} color={Colors.orange} />
          <Text style={styles.headerText}>Aucun groupe d'urgence actif</Text>
        </View>
        <Text style={styles.noGroupText}>
          Un groupe sera créé automatiquement lors de votre prochaine alerte
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={openGroup} activeOpacity={0.9}>
      <View style={styles.header}>
        <MaterialIcons name="group" size={24} color={Colors.orange} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>{groupData.title}</Text>
          <Text style={styles.memberCount}>
            {groupData.member_count} participant{groupData.member_count > 1 ? 's' : ''}
          </Text>
        </View>
        <AntDesign name="right" size={16} color="#666" />
      </View>

      {groupData.recent_messages.length > 0 ? (
        <ScrollView style={styles.messagesContainer} showsVerticalScrollIndicator={false}>
          {groupData.recent_messages.map((message) => (
            <View key={message.id} style={styles.messagePreview}>
              <View style={styles.messageHeader}>
                <Text style={styles.senderName} numberOfLines={1}>
                  {message.sender_name}
                </Text>
                <Text style={styles.messageTime}>
                  {formatMessageTime(message.created_at)}
                </Text>
                {message.is_urgent && (
                  <MaterialIcons name="priority-high" size={14} color={Colors.red} />
                )}
              </View>
              <Text style={styles.messageContent} numberOfLines={2}>
                {message.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noMessagesContainer}>
          <Text style={styles.noMessagesText}>
            Aucun message pour le moment
          </Text>
          <Text style={styles.tapToOpenText}>
            Touchez pour ouvrir le groupe
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 160,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  memberCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  messagesContainer: {
    maxHeight: 100,
  },
  messagePreview: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.orange,
    flex: 1,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginLeft: 8,
  },
  messageContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  noMessagesContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noMessagesText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tapToOpenText: {
    fontSize: 12,
    color: Colors.orange,
    fontStyle: 'italic',
  },
  noGroupText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
  },
});