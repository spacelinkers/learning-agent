import { useState } from 'react'
import {
  KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert,
} from 'react-native'
import { colors } from '@/constants/colors'
import { signIn, signUp } from '@/lib/auth'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')

  async function handleSubmit() {
    if (!email || !password) return
    setLoading(true)
    try {
      const { error } = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password)
      if (error) Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>🎯</Text>
      <Text style={styles.title}>Learning Agent</Text>
      <Text style={styles.subtitle}>
        {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(m => m === 'signin' ? 'signup' : 'signin')}>
        <Text style={styles.toggle}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  logo:      { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title:     { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle:  { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 32, marginTop: 4 },
  input:     { backgroundColor: colors.card, color: colors.text, borderRadius: 12,
               padding: 14, fontSize: 15, marginBottom: 12 },
  btn:       { backgroundColor: colors.primary, borderRadius: 12, padding: 16,
               alignItems: 'center', marginBottom: 16 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  toggle:    { color: colors.primary, textAlign: 'center', fontSize: 14 },
})
