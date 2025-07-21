import { create } from 'zustand'
import { supabase } from "@/lib/supabase"
import { Session } from "@supabase/supabase-js"
import { Profile } from "@/types/Profile"

interface AuthStore {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  initialize: () => Promise<void>
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
  }

//   updateProfile: async () => {

//   }
}))