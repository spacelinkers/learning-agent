import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function icon(name: IoniconName, focused: boolean) {
  return <Ionicons name={focused ? name : `${name}-outline` as IoniconName} size={24} color={focused ? colors.primary : colors.muted} />
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle:           { backgroundColor: colors.card, borderTopColor: colors.card, height: 60 },
        tabBarActiveTintColor:  colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle:      { fontSize: 11, marginBottom: 6 },
        headerStyle:           { backgroundColor: colors.bg },
        headerTintColor:       colors.text,
        headerShadowVisible:   false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ focused }) => icon('today', focused) }}
      />
      <Tabs.Screen
        name="paths"
        options={{ title: 'Paths', tabBarIcon: ({ focused }) => icon('library', focused) }}
      />
      <Tabs.Screen
        name="import"
        options={{ title: 'Import', tabBarIcon: ({ focused }) => icon('cloud-upload', focused) }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: 'Log', tabBarIcon: ({ focused }) => icon('pencil', focused) }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Library', tabBarIcon: ({ focused }) => icon('book', focused) }}
      />
    </Tabs>
  )
}
