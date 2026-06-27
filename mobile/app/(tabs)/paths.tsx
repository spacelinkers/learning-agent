import { useEffect } from 'react'
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { PathCard } from '@/components/PathCard'
import { usePaths } from '@/hooks/usePaths'
import { useRouter } from 'expo-router'

export default function PathsScreen() {
  const { paths, loading, error, refresh, updateStatus } = usePaths()
  const router = useRouter()

  useEffect(() => { refresh() }, [])

  function handleLongPress(pathId: string, currentStatus: string) {
    const isPaused = currentStatus === 'paused'
    Alert.alert(
      'Path Options',
      undefined,
      [
        { text: isPaused ? 'Resume' : 'Pause', onPress: () => updateStatus(pathId, isPaused ? 'active' : 'paused') },
        { text: 'Mark Complete', style: 'destructive', onPress: () => updateStatus(pathId, 'completed') },
        { text: 'Cancel', style: 'cancel' },
      ],
    )
  }

  if (loading && !paths.length) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={paths}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <PathCard
            path={item}
            onPress={() => router.push(`/path/${item.id}` as any)}
            // progress & pace come from the planner; shown when path detail is loaded
          />
        )}
        ListHeaderComponent={
          <Text style={styles.heading}>My Learning Paths</Text>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No active paths.{'\n'}Go to Import to add your first one!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/import')}>
        <Text style={styles.fabText}>＋ Import</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list:      { padding: 16, paddingBottom: 90 },
  heading:   { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 22 },
  fab:       { position: 'absolute', bottom: 24, right: 24,
               backgroundColor: colors.primary, borderRadius: 28,
               paddingHorizontal: 20, paddingVertical: 14, elevation: 4 },
  fabText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
})
