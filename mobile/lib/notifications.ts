import Constants from 'expo-constants'
import { Platform } from 'react-native'

// Remote push notifications were removed from Expo Go in SDK 53.
// All notification code uses dynamic imports guarded by this flag so
// the app runs normally in Expo Go; push activates in development/production builds.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient'

/**
 * Register for push notifications and save the token to the backend.
 * No-op in Expo Go — skips silently, does not throw.
 */
export async function setupPushNotifications(): Promise<void> {
  if (IS_EXPO_GO) return

  try {
    const Notifications = await import('expo-notifications')

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    })

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      })
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    const { status } =
      existing === 'granted'
        ? { status: existing }
        : await Notifications.requestPermissionsAsync()

    if (status !== 'granted') return

    const token = await Notifications.getExpoPushTokenAsync()
    const { api } = await import('./api')
    await api.savePushToken(token.data)
  } catch {
    // Non-critical — notifications degrade gracefully
  }
}

/**
 * Listen for notification taps and call onTap().
 * Returns a cleanup function. No-op in Expo Go.
 */
export function registerNotificationTapListener(onTap: () => void): () => void {
  if (IS_EXPO_GO) return () => {}

  let sub: { remove(): void } | null = null
  import('expo-notifications').then(Notifications => {
    sub = Notifications.addNotificationResponseReceivedListener(onTap)
  })

  return () => sub?.remove()
}
