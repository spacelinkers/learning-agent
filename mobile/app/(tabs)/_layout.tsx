import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// Each tab has its own accent color for identity
const TAB_COLORS = {
  index:   colors.primary,   // Today → indigo
  paths:   colors.violet,    // Paths → violet
  import:  colors.teal,      // Import → teal
  log:     colors.amber,     // Log → amber
  library: colors.cyan,      // Library → cyan
}

function tabIcon(name: IoniconName, focused: boolean, color: string) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconName)}
      size={24}
      color={focused ? color : colors.muted}
    />
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle:            { backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, height: 60 },
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle:       { fontSize: 11, marginBottom: 6 },
        headerStyle:            { backgroundColor: colors.bg },
        headerTintColor:        colors.text,
        headerShadowVisible:    false,
        headerTitleStyle:       { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarActiveTintColor: TAB_COLORS.index,
          tabBarIcon: ({ focused }) => tabIcon('today', focused, TAB_COLORS.index),
        }}
      />
      <Tabs.Screen
        name="paths"
        options={{
          title: 'Paths',
          tabBarActiveTintColor: TAB_COLORS.paths,
          tabBarIcon: ({ focused }) => tabIcon('library', focused, TAB_COLORS.paths),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: 'Import',
          tabBarActiveTintColor: TAB_COLORS.import,
          tabBarIcon: ({ focused }) => tabIcon('cloud-upload', focused, TAB_COLORS.import),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarActiveTintColor: TAB_COLORS.log,
          tabBarIcon: ({ focused }) => tabIcon('pencil', focused, TAB_COLORS.log),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarActiveTintColor: TAB_COLORS.library,
          tabBarIcon: ({ focused }) => tabIcon('book', focused, TAB_COLORS.library),
        }}
      />
    </Tabs>
  )
}
