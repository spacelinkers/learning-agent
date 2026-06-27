import { useEffect } from 'react'
import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { TaskCard } from '@/components/TaskCard'
import { useTodayPlan } from '@/hooks/useTodayPlan'

export default function TodayScreen() {
  const { plan, loading, error, refresh, markDone, skipTask } = useTodayPlan()

  useEffect(() => { refresh() }, [])

  const done  = plan?.items.filter(i => i.status === 'done').length  ?? 0
  const total = plan?.items.length ?? 0
  const pct   = total > 0 ? done / total : 0

  if (loading && !plan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Generating your plan…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plan?.items ?? []}
        keyExtractor={item => item.item_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>
              {done === total && total > 0 ? '🎉 All done today!' : `📚 ${total - done} task${total - done !== 1 ? 's' : ''} remaining`}
            </Text>
            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{done}/{total} completed · {plan?.hours_budget}h budget</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TaskCard
            item={item}
            onDone={() => markDone(item.item_id)}
            onSkip={() => skipTask(item.item_id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No tasks yet — import a learning path to get started!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:   { marginTop: 12, color: colors.muted, fontSize: 14 },
  errorText:     { color: colors.danger, textAlign: 'center' },
  emptyText:     { color: colors.muted, textAlign: 'center', lineHeight: 22 },
  list:          { padding: 16, paddingBottom: 32 },
  header:        { marginBottom: 20 },
  greeting:      { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
  progressTrack: { height: 6, backgroundColor: colors.card, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressLabel: { marginTop: 6, fontSize: 12, color: colors.muted },
})
