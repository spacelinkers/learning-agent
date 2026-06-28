import { useEffect, useRef } from 'react'
import { useRouter, useSegments, Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '@/hooks/useAuth'
import { colors } from '@/constants/colors'
import { setupPushNotifications, registerNotificationTapListener } from '@/lib/notifications'

function AuthGuard() {
  const { session, loading } = useAuth()
  const router               = useRouter()
  const segments             = useSegments()
  const pushRegistered       = useRef(false)

  // Auth redirect
  useEffect(() => {
    if (loading) return
    const onLoginScreen = segments[0] === 'login'
    if (!session && !onLoginScreen) router.replace('/login')
    if ( session &&  onLoginScreen) router.replace('/')
  }, [session, loading])

  // Register push token once per session (no-op in Expo Go)
  useEffect(() => {
    if (session && !pushRegistered.current) {
      pushRegistered.current = true
      setupPushNotifications()
    }
    if (!session) pushRegistered.current = false
  }, [session])

  // Navigate to Today tab when user taps a notification (no-op in Expo Go)
  useEffect(() => {
    return registerNotificationTapListener(() => router.push('/(tabs)/'))
  }, [])

  return <Slot />
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg} />
      <AuthGuard />
    </>
  )
}
