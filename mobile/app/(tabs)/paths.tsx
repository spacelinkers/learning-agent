import { useEffect } from 'react'
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { PathCard } from '@/components/PathCard'
import { usePaths } from '@/hooks/usePaths'
import { useRouter } from 'expo-router'

export default function PathsScreen() {
  const { paths, loading, error, refresh, updateStatus, deletePath } = usePaths()
  const router = useRouter()

  useEffect(() => { refresh() }, [])

  function handleLongPress(pathId: string, pathTitle: string, currentStatus: string) {
    const isPaused = currentStatus === 'paused'
    Alert.alert('Path Options', pathTitle, [
      {
        text: isPaused ? 'Resume' : 'Pause',
        onPress: () => updateStatus(pathId, isPaused ? 'active' : 'paused'),
      },
      {
        text: 'Mark Complete',
        onPress: () => updateStatus(pathId, 'completed'),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete path?', `"${pathTitle}" and all its tracks and tasks will be permanently deleted.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deletePath(pathId) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  if (loading && !paths.length) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.violet} /></View>
  }

  const activeCount = paths.filter(p => p.status === 'active').length

  return (
    <View style={styles.container}>
      <FlatList
        data={paths}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.violet} />}
        renderItem={({ item }) => (
          <PathCard
            path={item}
            onPress={() => router.push(`/path/${item.id}` as any)}
            onLongPress={() => handleLongPress(item.id, item.title, item.status)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View style={[styles.headerAccent, { backgroundColor: colors.violet }]} />
            <Text style={styles.heading}>My Paths</Text>
            {paths.length > 0 && (
              <View style={styles.countChip}>
                <Text style={styles.countText}>{activeCount} active</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="map-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>No paths yet</Text>
            <Text style={styles.emptyText}>Use Import to add your first learning path.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/import')}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.fabText}>Import</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { padding: 16, paddingBottom: 100 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  headerAccent:{ width: 4, height: 24, borderRadius: 2 },
  heading:     { fontSize: 22, fontWeight: '800', color: colors.text },
  countChip:   { backgroundColor: colors.violetMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countText:   { color: colors.violet, fontSize: 12, fontWeight: '700' },
  emptyBox:    { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: colors.textSub, marginTop: 8 },
  emptyText:   { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  fab:         { position: 'absolute', bottom: 24, right: 24,
                 backgroundColor: colors.violet, borderRadius: 28, flexDirection: 'row',
                 alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 13, elevation: 4 },
  fabText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
})
