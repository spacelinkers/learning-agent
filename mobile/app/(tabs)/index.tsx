import { useEffect } from 'react'
import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { TaskCard } from '@/components/TaskCard'
import { ProgressRing } from '@/components/ProgressRing'
import { useTodayPlan } from '@/hooks/useTodayPlan'

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function TodayScreen() {
  const { plan, loading, error, refresh, markDone, skipTask } = useTodayPlan()

  useEffect(() => { refresh() }, [])

  const done  = plan?.items.filter(i => i.status === 'done').length ?? 0
  const total = plan?.items.length ?? 0
  const pct   = total > 0 ? done / total : 0

  const now     = new Date()
  const dateStr = `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`

  if (loading && !plan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Building your plan…</Text>
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

  const allDone = done === total && total > 0

  return (
    <View style={styles.container}>
      <FlatList
        data={plan?.items ?? []}
        keyExtractor={item => item.item_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                <Text style={styles.dateText}>{dateStr}</Text>
                <Text style={styles.heroTitle}>
                  {allDone ? 'All done today! 🎉' : `${total - done} task${total - done !== 1 ? 's' : ''} left`}
                </Text>
                <Text style={styles.heroSub}>{done} of {total} completed</Text>
                {!!plan?.hours_budget && (
                  <View style={styles.budgetChip}>
                    <Text style={styles.budgetText}>{plan.hours_budget}h budget</Text>
                  </View>
                )}
              </View>
              <ProgressRing
                progress={pct}
                size={72}
                strokeWidth={6}
                color={allDone ? colors.success : colors.primary}
              />
            </View>

            {total > 0 && <Text style={styles.sectionLabel}>Today's Tasks</Text>}
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
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No tasks today</Text>
            <Text style={styles.emptyText}>Import a learning path to get started!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: colors.textSub, fontSize: 14 },
  errorText:   { color: colors.danger, textAlign: 'center' },
  list:        { padding: 16, paddingBottom: 32 },

  heroCard:    { backgroundColor: colors.card, borderRadius: 16, padding: 20,
                 flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  heroLeft:    { flex: 1, paddingRight: 12 },
  dateText:    { fontSize: 12, color: colors.textSub, fontWeight: '500', marginBottom: 6, letterSpacing: 0.3 },
  heroTitle:   { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2, lineHeight: 26 },
  heroSub:     { fontSize: 13, color: colors.textSub, marginBottom: 10 },
  budgetChip:  { backgroundColor: colors.primaryMuted, alignSelf: 'flex-start',
                 paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  budgetText:  { color: colors.primary, fontSize: 12, fontWeight: '600' },

  sectionLabel:{ fontSize: 11, color: colors.muted, fontWeight: '700', textTransform: 'uppercase',
                 letterSpacing: 0.8, marginBottom: 12 },
  emptyBox:    { alignItems: 'center', paddingVertical: 40 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: colors.textSub, marginBottom: 6 },
  emptyText:   { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
})
