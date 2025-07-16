// src/store/useAlertsStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { Alert } from '../types/Alert'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Profile } from '@/types/Profile'

interface AlertsState {
  alerts: (Alert & Profile)[]
  isLoading: boolean
  error: string | null
  fetchAlerts: () => Promise<void>
  createAlert: (creatorId: string, status: string) => Promise<void>
  subscribeAlerts: () => RealtimeChannel
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  isLoading: false,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null })
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        profiles (
          id,
          full_name,
          first_name,
          last_name,
          avatar_url,
          updated_at
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    console.log('Fetched alerts:', JSON.stringify(data, null, 2))
    if (error) set({ error: error.message })
    else set({ alerts: data as (Alert & Profile)[] })
    set({ isLoading: false })
  },

  createAlert: async (creatorId, status) => {
    set({ isLoading: true, error: null })
    const { error } = await supabase
      .from('alerts')
      .insert({ creator_id: creatorId, status })
    if (error) set({ error: error.message })
    set({ isLoading: false })
    await get().fetchAlerts()
  },

  subscribeAlerts: () => {
    const channel: RealtimeChannel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => {
          console.log('🔔 Alert change detected')
          get().fetchAlerts()
        }
      )
    channel.subscribe()
    return channel
  }
}))