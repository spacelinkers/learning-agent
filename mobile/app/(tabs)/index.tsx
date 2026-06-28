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
  const allDone = done === total && total > 0

  // Progress ring color shifts as tasks complete: amber → teal → emerald
  const ringColor = allDone
    ? colors.success
    : pct < 0.4 ? colors.warning : pct < 0.8 ? colors.teal : colors.success

  if (loading && !plan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cyan} />
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

  return (
    <View style={styles.container}>
      <FlatList
        data={plan?.items ?? []}
        keyExtractor={item => item.item_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.cyan} />}
        ListHeaderComponent={
          <View>
            {/* Hero card with indigo→cyan gradient strip */}
            <View style={styles.heroCard}>
              <View style={styles.heroGradientStrip}>
                <View style={[styles.heroStripSegment, { backgroundColor: colors.primary, flex: 2 }]} />
                <View style={[styles.heroStripSegment, { backgroundColor: colors.violet, flex: 1 }]} />
                <View style={[styles.heroStripSegment, { backgroundColor: colors.cyan, flex: 2 }]} />
              </View>
              <View style={styles.heroInner}>
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
                  color={ringColor}
                />
              </View>
            </View>

            {total > 0 && (
              <View style={styles.sectionRow}>
                <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
                <View style={[styles.sectionDot, { backgroundColor: colors.cyan }]} />
                <Text style={styles.sectionLabel}>Today's Tasks</Text>
              </View>
            )}
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
  container:        { flex: 1, backgroundColor: colors.bg },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:      { marginTop: 12, color: colors.textSub, fontSize: 14 },
  errorText:        { color: colors.danger, textAlign: 'center' },
  list:             { padding: 16, paddingBottom: 32 },

  heroCard:         { backgroundColor: colors.card, borderRadius: 16, marginBottom: 24,
                      borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  heroGradientStrip:{ flexDirection: 'row', height: 4 },
  heroStripSegment: { height: 4 },
  heroInner:        { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLeft:         { flex: 1, paddingRight: 12 },
  dateText:         { fontSize: 12, color: colors.textSub, fontWeight: '500', marginBottom: 6, letterSpacing: 0.3 },
  heroTitle:        { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2, lineHeight: 26 },
  heroSub:          { fontSize: 13, color: colors.textSub, marginBottom: 10 },
  budgetChip:       { backgroundColor: colors.cyanMuted, alignSelf: 'flex-start',
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                      borderWidth: 1, borderColor: colors.cyan + '33' },
  budgetText:       { color: colors.cyan, fontSize: 12, fontWeight: '600' },

  sectionRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  sectionDot:       { width: 6, height: 6, borderRadius: 3 },
  sectionLabel:     { fontSize: 11, color: colors.textSub, fontWeight: '700',
                      textTransform: 'uppercase', letterSpacing: 0.8 },
  emptyBox:         { alignItems: 'center', paddingVertical: 40 },
  emptyTitle:       { fontSize: 16, fontWeight: '700', color: colors.textSub, marginBottom: 6 },
  emptyText:        { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
})
