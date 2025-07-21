import { create } from 'zustand'
import { supabase } from "@/lib/supabase"
import { Session } from "@supabase/supabase-js"
import { Profile } from "@/types/Profile"

interface AuthStore {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  initialize: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  isLoading: true,
  profile: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ session, isLoading: false })
      
      supabase.auth.onAuthStateChange((event, session) => {
        set({ session })
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ isLoading: false })
    }

    const currentSession = get().session
    if (currentSession?.user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentSession.user.id)
      
      if (error) {
        console.error('Profile fetch error:', error)
      } else {
        set({ profile: data?.[0] || null })
      }
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { session, profile } = get()
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return { success: false, error: 'User not authenticated' }
    }

    // Check if we have a current profile
    if (!profile) {
      return { success: false, error: 'No profile found' }
    }

    try {
      // Remove id, created_at from updates to prevent conflicts
      const { id, created_at, ...safeUpdates } = updates
      
      // Add updated_at timestamp
      const updatedData = {
        ...safeUpdates,
      }

      // Update in Supabase
      const { data, error } = await supabase
        .from("profiles")
        .update(updatedData)
        .eq("id", session.user.id)
        .select("*")
        .single()

      if (error) {
        console.error('Profile update error:', error)
        return { success: false, error: error.message }
      }

      // Update local state with the returned data
      set({ profile: data })
      
      console.log('Profile updated successfully:', data)
      return { success: true }

    } catch (error: any) {
      console.error('Profile update error:', error)
      return { success: false, error: error.message || 'Failed to update profile' }
    }
  }
}))