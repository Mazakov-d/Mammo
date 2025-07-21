import { create } from 'zustand'
import { supabase } from "@/lib/supabase"
import { Session } from "@supabase/supabase-js"

interface AuthStore {
  session: Session | null
  isLoading: boolean
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  isLoading: true,
  
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
  }
}))