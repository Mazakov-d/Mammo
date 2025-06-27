// app/groups/[id].tsx - Emergency Group Chat Page

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { AntDesign, Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface GroupMessage {
  id: string;
  content: string;
  message_type: 'text' | 'location' | 'image' | 'system' | 'status_update';
  created_at: string;
  sender_id: string;
  is_urgent: boolean;
  sender_profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface GroupInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  member_count: number;
}

export default function GroupChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) {
      loadGroupInfo();
      loadMessages();
      
      // Subscribe to real-time messages
      const messagesSubscription = supabase
        .channel(`group_messages_${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "emergency_group_messages",
            filter: `group_id=eq.${id}`,
          },
          (payload) => {
            console.log('New message received:', payload.new);
            loadMessages(); // Reload to get sender info
          }
        )
        .subscribe();

      return () => {
        messagesSubscription.unsubscribe();
      };
    }
  }, [id]);

  const loadGroupInfo = async () => {
    try {
      if (!id || !session?.user?.id) return;

      const { data: group, error } = await supabase
        .from('emergency_groups')
        .select(`
          id,
          title,
          status,
          priority
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch member count separately
      const { count: member_count, error: countError } = await supabase
        .from('emergency_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', id)
        .eq('status', 'accepted');

      if (countError) throw countError;

      setGroupInfo({
        ...group,
        member_count: member_count ?? 0,
      });
    } catch (error) {
      console.error("Failed to load group info:", error);
      Alert.alert("Erreur", "Impossible de charger les informations du groupe");
    }
  };

  const loadMessages = async () => {
    try {
      if (!id) return;

      const { data: messages, error } = await supabase
        .from('emergency_group_messages')
        .select(`
          id,
          content,
          message_type,
          created_at,
          sender_id,
          is_urgent,
          profiles!emergency_group_messages_sender_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const processedMessages = messages?.map(msg => ({
        id: msg.id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        is_urgent: msg.is_urgent,
        sender_profile: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles,
      })) || [];

      setMessages(processedMessages);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !id || !session?.user?.id || sending) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('emergency_group_messages')
        .insert({
          group_id: id,
          sender_id: session.user.id,
          content: newMessage.trim(),
          message_type: 'text',
          is_urgent: false,
        });

      if (error) throw error;

      setNewMessage("");
      
    } catch (error) {
      console.error("Failed to send message:", error);
      Alert.alert("Erreur", "Impossible d'envoyer le message");
    } finally {
      setSending(false);
    }
  };

  const sendLocationMessage = async () => {
    // Implementation for sending location
    Alert.alert("Fonctionnalité", "Partage de localisation à venir");
  };

  const resolveGroup = async () => {
    Alert.alert(
      "Résoudre le groupe",
      "Êtes-vous sûr de vouloir marquer ce groupe comme résolu ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Résoudre",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('emergency_groups')
                .update({ 
                  status: 'resolved',
                  resolved_at: new Date().toISOString()
                })
                .eq('id', id);

              if (error) throw error;

              Alert.alert("Succès", "Groupe marqué comme résolu");
              router.back();
            } catch (error) {
              console.error("Failed to resolve group:", error);
              Alert.alert("Erreur", "Impossible de résoudre le groupe");
            }
          }
        }
      ]
    );
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `${minutes}min`;
    if (minutes < 1440) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
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

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMyMessage = item.sender_id === session?.user?.id;
    const senderName = item.sender_profile?.full_name || 'Utilisateur';
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}>
        {!isMyMessage && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          item.is_urgent && styles.urgentMessage
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading || !groupInfo) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerTitle: "Chargement..." }} />
        <Text>Chargement du groupe...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 44}
    >
      <Stack.Screen
        options={{
          headerTitle: groupInfo.title,
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
                onPress={resolveGroup}
                style={styles.headerButton}
              >
                <MaterialIcons name="check-circle" size={24} color={Colors.orange} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Group Status Bar */}
      <View style={[
        styles.statusBar,
        { backgroundColor: getPriorityColor(groupInfo.priority) }
      ]}>
        <View style={styles.statusInfo}>
          <Text style={styles.statusText}>
            {groupInfo.member_count} participant{groupInfo.member_count > 1 ? 's' : ''}
          </Text>
          <Text style={styles.statusPriority}>
            Priorité: {groupInfo.priority.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={sendLocationMessage}
          >
            <Feather name="map-pin" size={20} color={Colors.orange} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.messageInput}
            placeholder="Tapez votre message..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Feather name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  },
  headerActions: {
    flexDirection: 'row',
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 10,
  },
  statusBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 100,
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusPriority: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: Colors.orange,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  urgentMessage: {
    borderWidth: 2,
    borderColor: Colors.red,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: Colors.primary,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
  },
  inputContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: Colors.primary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});