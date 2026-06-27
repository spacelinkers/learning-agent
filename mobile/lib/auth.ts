import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Supabase recommends using SecureStore instead of AsyncStorage for tokens
const SecureStoreAdapter = {
  getItem:    (key: string)              => SecureStore.getItemAsync(key),
  setItem:    (key: string, val: string) => SecureStore.setItemAsync(key, val),
  removeItem: (key: string)              => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export async function getSupabaseToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export const signIn  = (email: string, pw: string) =>
  supabase.auth.signInWithPassword({ email, password: pw })

export const signUp  = (email: string, pw: string) =>
  supabase.auth.signUp({
    email,
    password: pw,
    options: { emailRedirectTo: 'learning-agent://login' },
  })

export const signOut = () => supabase.auth.signOut()
